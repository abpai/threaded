import { useState, useEffect, useCallback, useMemo } from 'react'
import * as api from '../lib/api'
import type { ApiThreadType } from '../lib/api'

// localStorage key for session ownership data
const STORAGE_KEY = 'threaded:sessions'

interface SessionOwnership {
  ownerToken: string
  forkedFrom: string | null
  threadIdMap?: Record<string, string>
}

type SessionsStore = Record<string, SessionOwnership>

function getSessionsStore(): SessionsStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function setSessionOwnership(
  sessionId: string,
  ownerToken: string,
  forkedFrom: string | null = null,
  threadIdMap?: Record<string, string>
): void {
  const store = getSessionsStore()
  store[sessionId] = { ownerToken, forkedFrom, threadIdMap }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function getSessionOwnership(sessionId: string): SessionOwnership | null {
  const store = getSessionsStore()
  return store[sessionId] || null
}

function removeSessionOwnership(sessionId: string): void {
  const store = getSessionsStore()
  delete store[sessionId]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

// Find existing fork of a session
function getExistingFork(originalSessionId: string): string | null {
  const store = getSessionsStore()
  for (const [sessionId, ownership] of Object.entries(store)) {
    if (ownership.forkedFrom === originalSessionId) {
      return sessionId
    }
  }
  return null
}

export interface UseSessionOptions {
  onSessionChange?: (newSessionId: string) => void
}

export interface UseSessionResult {
  // Data
  session: api.ApiSession | null
  isLoading: boolean

  // Ownership
  isOwner: boolean
  ownerToken: string | null

  // Actions
  addThread: (context: string, snippet: string, type?: ApiThreadType) => Promise<string | null>
  addMessage: (threadId: string, role: 'user' | 'assistant', text: string) => Promise<string | null>
  updateMessage: (threadId: string, messageId: string, text: string) => Promise<void>
  deleteThread: (threadId: string) => Promise<boolean>
  truncateThread: (threadId: string, afterMessageId: string) => Promise<void>
  deleteSession: () => Promise<boolean>
  forkAndRedirect: () => Promise<string | null>
}

export function useSession(
  sessionId: string | null,
  options?: UseSessionOptions
): UseSessionResult {
  const onSessionChange = options?.onSessionChange
  const [session, setSession] = useState<api.ApiSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Get ownership info
  const ownership = useMemo(() => (sessionId ? getSessionOwnership(sessionId) : null), [sessionId])

  const isOwner = ownership !== null
  const ownerToken = ownership?.ownerToken ?? null

  // Load on mount and when sessionId changes
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!sessionId) {
        setSession(null)
        return
      }

      setIsLoading(true)

      try {
        const data = await api.getSession(sessionId)
        if (!cancelled) {
          setSession(data)
        }
      } catch {
        if (!cancelled) {
          setSession(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // Fork and redirect (for non-owners)
  const forkAndRedirect = useCallback(async (): Promise<string | null> => {
    if (!sessionId) return null

    // Check for existing fork first
    const existingFork = getExistingFork(sessionId)
    if (existingFork) {
      // Redirect to existing fork
      window.history.replaceState(null, '', `/${existingFork}`)
      onSessionChange?.(existingFork)
      return existingFork
    }

    try {
      const result = await api.forkSession(sessionId)

      // Store ownership of new session with thread ID mapping
      setSessionOwnership(result.sessionId, result.ownerToken, sessionId, result.threadIdMap)

      // Update URL without reload
      window.history.replaceState(null, '', `/${result.sessionId}`)

      // Notify parent of session change
      onSessionChange?.(result.sessionId)

      return result.sessionId
    } catch {
      return null
    }
  }, [sessionId, onSessionChange])

  // Add thread (handles fork for non-owners)
  const addThread = useCallback(
    async (
      context: string,
      snippet: string,
      type: ApiThreadType = 'discussion'
    ): Promise<string | null> => {
      if (!sessionId) return null

      let targetSessionId = sessionId
      let targetOwnerToken = ownerToken

      // Fork if not owner
      if (!isOwner) {
        const forkedId = await forkAndRedirect()
        if (!forkedId) return null

        targetSessionId = forkedId
        const newOwnership = getSessionOwnership(forkedId)
        targetOwnerToken = newOwnership?.ownerToken ?? null
      }

      if (!targetOwnerToken) return null

      try {
        const result = await api.addThread(
          targetSessionId,
          targetOwnerToken,
          context,
          snippet,
          type
        )
        return result.threadId
      } catch {
        return null
      }
    },
    [sessionId, isOwner, ownerToken, forkAndRedirect]
  )

  // Add message (handles fork for non-owners)
  const addMessage = useCallback(
    async (threadId: string, role: 'user' | 'assistant', text: string): Promise<string | null> => {
      if (!sessionId) return null

      let targetSessionId = sessionId
      let targetOwnerToken = ownerToken
      let targetThreadId = threadId

      // Fork if not owner
      if (!isOwner) {
        const forkedId = await forkAndRedirect()
        if (!forkedId) return null

        targetSessionId = forkedId
        const newOwnership = getSessionOwnership(forkedId)
        targetOwnerToken = newOwnership?.ownerToken ?? null

        // Map old thread ID to new thread ID after fork
        if (newOwnership?.threadIdMap?.[threadId]) {
          targetThreadId = newOwnership.threadIdMap[threadId]
        }
      }

      if (!targetOwnerToken) return null

      try {
        // Convert "assistant" to "model" for API (backend still uses "model")
        const apiRole = role === 'assistant' ? 'model' : role
        const result = await api.addMessage(
          targetSessionId,
          targetOwnerToken,
          targetThreadId,
          apiRole,
          text
        )
        return result.messageId
      } catch {
        return null
      }
    },
    [sessionId, isOwner, ownerToken, forkAndRedirect]
  )

  const updateMessage = useCallback(
    async (threadId: string, messageId: string, text: string): Promise<void> => {
      if (!sessionId || !ownerToken || !isOwner) return

      try {
        await api.updateMessage(sessionId, ownerToken, threadId, messageId, text)
      } catch {
        // Silently fail - caller can check message state if needed
      }
    },
    [sessionId, isOwner, ownerToken]
  )

  const truncateThread = useCallback(
    async (threadId: string, afterMessageId: string): Promise<void> => {
      if (!sessionId || !ownerToken || !isOwner) return

      try {
        await api.truncateThread(sessionId, ownerToken, threadId, afterMessageId)
      } catch {
        // Silently fail - caller can check thread state if needed
      }
    },
    [sessionId, isOwner, ownerToken]
  )

  // Delete thread (owner only)
  const deleteThread = useCallback(
    async (threadId: string): Promise<boolean> => {
      if (!sessionId || !ownerToken || !isOwner) return false

      try {
        await api.deleteThread(sessionId, ownerToken, threadId)
        return true
      } catch {
        return false
      }
    },
    [sessionId, isOwner, ownerToken]
  )

  // Delete session (owner only)
  const deleteSession = useCallback(async (): Promise<boolean> => {
    if (!sessionId || !ownerToken) return false

    try {
      await api.deleteSession(sessionId, ownerToken)

      // Remove from local storage
      removeSessionOwnership(sessionId)

      return true
    } catch {
      return false
    }
  }, [sessionId, ownerToken])

  return {
    session,
    isLoading,
    isOwner,
    ownerToken,
    addThread,
    addMessage,
    updateMessage,
    deleteThread,
    truncateThread,
    deleteSession,
    forkAndRedirect,
  }
}

// Helper to create a new session
export async function createNewSession(
  markdownContent: string
): Promise<{ sessionId: string; ownerToken: string } | null> {
  try {
    const result = await api.createSession(markdownContent)
    setSessionOwnership(result.sessionId, result.ownerToken)
    return result
  } catch (e) {
    console.error('Failed to create session:', e)
    return null
  }
}
