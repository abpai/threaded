import { useState, useEffect, useCallback, useMemo } from "react"
import * as api from "../lib/api"

// localStorage key for session ownership data
const STORAGE_KEY = "threaded:sessions"

interface SessionOwnership {
  ownerToken: string
  forkedFrom: string | null
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
  forkedFrom: string | null = null
): void {
  const store = getSessionsStore()
  store[sessionId] = { ownerToken, forkedFrom }
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

export type SaveState = "idle" | "saving" | "error"

export interface UseSessionOptions {
  onSessionChange?: (newSessionId: string) => void
}

export interface UseSessionResult {
  // Data
  session: api.ApiSession | null
  isLoading: boolean
  loadError: string | null

  // Ownership
  isOwner: boolean
  ownerToken: string | null

  // Save state
  saveState: SaveState
  saveError: string | null

  // Actions
  addThread: (context: string, snippet: string) => Promise<string | null>
  addMessage: (threadId: string, role: "user" | "model", text: string) => Promise<void>
  deleteSession: () => Promise<boolean>
  forkAndRedirect: () => Promise<string | null>

  // Refresh
  refresh: () => Promise<void>
}

export function useSession(
  sessionId: string | null,
  options?: UseSessionOptions
): UseSessionResult {
  const onSessionChange = options?.onSessionChange
  const [session, setSession] = useState<api.ApiSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)

  // Get ownership info
  const ownership = useMemo(() => (sessionId ? getSessionOwnership(sessionId) : null), [sessionId])

  const isOwner = ownership !== null
  const ownerToken = ownership?.ownerToken ?? null

  // Load session data
  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await api.getSession(sessionId)
      setSession(data)
    } catch (e) {
      const message = e instanceof api.ApiError ? e.message : "Failed to load session"
      setLoadError(message)
      setSession(null)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  // Load on mount and when sessionId changes
  useEffect(() => {
    loadSession()
  }, [loadSession])

  // Fork and redirect (for non-owners)
  const forkAndRedirect = useCallback(async (): Promise<string | null> => {
    if (!sessionId) return null

    // Check for existing fork first
    const existingFork = getExistingFork(sessionId)
    if (existingFork) {
      // Redirect to existing fork
      window.history.replaceState(null, "", `/${existingFork}`)
      onSessionChange?.(existingFork)
      return existingFork
    }

    try {
      setSaveState("saving")
      const result = await api.forkSession(sessionId)

      // Store ownership of new session
      setSessionOwnership(result.sessionId, result.ownerToken, sessionId)

      // Update URL without reload
      window.history.replaceState(null, "", `/${result.sessionId}`)

      // Notify parent of session change
      onSessionChange?.(result.sessionId)

      setSaveState("idle")
      return result.sessionId
    } catch (e) {
      const message = e instanceof api.ApiError ? e.message : "Failed to fork session"
      setSaveError(message)
      setSaveState("error")
      return null
    }
  }, [sessionId, onSessionChange])

  // Add thread (handles fork for non-owners)
  const addThread = useCallback(
    async (context: string, snippet: string): Promise<string | null> => {
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
        setSaveState("saving")
        setSaveError(null)

        const result = await api.addThread(targetSessionId, targetOwnerToken, context, snippet)

        setSaveState("idle")
        return result.threadId
      } catch (e) {
        const message = e instanceof api.ApiError ? e.message : "Failed to add thread"
        setSaveError(message)
        setSaveState("error")
        return null
      }
    },
    [sessionId, isOwner, ownerToken, forkAndRedirect]
  )

  // Add message (handles fork for non-owners)
  const addMessage = useCallback(
    async (threadId: string, role: "user" | "model", text: string): Promise<void> => {
      if (!sessionId) return

      let targetSessionId = sessionId
      let targetOwnerToken = ownerToken

      // Fork if not owner
      if (!isOwner) {
        const forkedId = await forkAndRedirect()
        if (!forkedId) return

        targetSessionId = forkedId
        const newOwnership = getSessionOwnership(forkedId)
        targetOwnerToken = newOwnership?.ownerToken ?? null
      }

      if (!targetOwnerToken) return

      try {
        setSaveState("saving")
        setSaveError(null)

        await api.addMessage(targetSessionId, targetOwnerToken, threadId, role, text)

        setSaveState("idle")
      } catch (e) {
        const message = e instanceof api.ApiError ? e.message : "Failed to add message"
        setSaveError(message)
        setSaveState("error")
      }
    },
    [sessionId, isOwner, ownerToken, forkAndRedirect]
  )

  // Delete session (owner only)
  const deleteSession = useCallback(async (): Promise<boolean> => {
    if (!sessionId || !ownerToken) return false

    try {
      setSaveState("saving")
      await api.deleteSession(sessionId, ownerToken)

      // Remove from local storage
      removeSessionOwnership(sessionId)

      setSaveState("idle")
      return true
    } catch (e) {
      const message = e instanceof api.ApiError ? e.message : "Failed to delete session"
      setSaveError(message)
      setSaveState("error")
      return false
    }
  }, [sessionId, ownerToken])

  return {
    session,
    isLoading,
    loadError,
    isOwner,
    ownerToken,
    saveState,
    saveError,
    addThread,
    addMessage,
    deleteSession,
    forkAndRedirect,
    refresh: loadSession,
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
    console.error("Failed to create session:", e)
    return null
  }
}
