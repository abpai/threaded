import { useState, useCallback, useMemo, Dispatch, SetStateAction } from 'react'
import { Thread, Message, MessagePart, getTextFromParts } from '../types'

export interface UseThreadManagerResult {
  threads: Thread[]
  activeThreadId: string | null
  activeThread: Thread | null
  setThreads: Dispatch<SetStateAction<Thread[]>>
  setActiveThreadId: (id: string | null) => void
  addThread: (thread: Thread) => void
  updateThreadId: (oldId: string, newId: string) => void
  deleteThread: (threadId: string) => void
  addMessageToThread: (threadId: string, message: Message) => void
  replaceMessageId: (threadId: string, oldId: string, newId: string) => void
  appendToLastMessage: (threadId: string, chunk: string) => void
  updateLastMessage: (threadId: string, text: string) => void
  replaceLastMessage: (threadId: string, message: Message) => void
  updateMessageToThread: (threadId: string, messageId: string, text: string) => void
  truncateThreadAfter: (threadId: string, messageId: string) => void
  updateMessageParts: (threadId: string, messageId: string, parts: MessagePart[]) => void
}

export function useThreadManager(initialThreads: Thread[] = []): UseThreadManagerResult {
  const [threads, setThreads] = useState<Thread[]>(initialThreads)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const activeThread = useMemo(
    () => threads.find(t => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  )

  const addThread = useCallback((thread: Thread) => {
    setThreads(prev => [...prev, thread])
  }, [])

  const updateThreadId = useCallback((oldId: string, newId: string) => {
    setThreads(prev => prev.map(t => (t.id === oldId ? { ...t, id: newId } : t)))
    setActiveThreadId(current => (current === oldId ? newId : current))
  }, [])

  const deleteThread = useCallback((threadId: string) => {
    setThreads(prev => prev.filter(t => t.id !== threadId))
    setActiveThreadId(current => (current === threadId ? null : current))
  }, [])

  const addMessageToThread = useCallback((threadId: string, message: Message) => {
    setThreads(prev =>
      prev.map(t => {
        if (t.id === threadId) {
          return { ...t, messages: [...t.messages, message] }
        }
        return t
      })
    )
  }, [])

  const replaceMessageId = useCallback((threadId: string, oldId: string, newId: string) => {
    setThreads(prev =>
      prev.map(t => {
        if (t.id !== threadId) return t
        const messages = t.messages.map(m => (m.id === oldId ? { ...m, id: newId } : m))
        return { ...t, messages }
      })
    )
  }, [])

  const appendToLastMessage = useCallback((threadId: string, chunk: string) => {
    setThreads(prev =>
      prev.map(t => {
        if (t.id === threadId) {
          const messages = [...t.messages]
          const lastMessage = messages[messages.length - 1]
          if (lastMessage && lastMessage.role === 'assistant') {
            // Append to text field (for legacy streaming)
            const newText = lastMessage.text + chunk
            // Also update parts if they exist
            const parts = [...(lastMessage.parts || [])]
            const lastPart = parts[parts.length - 1]
            if (lastPart?.type === 'text') {
              parts[parts.length - 1] = { ...lastPart, text: lastPart.text + chunk }
            } else {
              parts.push({ type: 'text', text: chunk })
            }
            messages[messages.length - 1] = {
              ...lastMessage,
              text: newText,
              parts,
            }
          }
          return { ...t, messages }
        }
        return t
      })
    )
  }, [])

  const updateLastMessage = useCallback((threadId: string, text: string) => {
    setThreads(prev =>
      prev.map(t => {
        if (t.id === threadId) {
          const messages = [...t.messages]
          const lastMessage = messages[messages.length - 1]
          if (lastMessage && lastMessage.role === 'assistant') {
            messages[messages.length - 1] = {
              ...lastMessage,
              text,
              parts: [{ type: 'text', text }],
            }
          }
          return { ...t, messages }
        }
        return t
      })
    )
  }, [])

  const replaceLastMessage = useCallback((threadId: string, message: Message) => {
    setThreads(prev =>
      prev.map(t => {
        if (t.id === threadId) {
          return { ...t, messages: [...t.messages.slice(0, -1), message] }
        }
        return t
      })
    )
  }, [])

  const updateMessageToThread = useCallback((threadId: string, messageId: string, text: string) => {
    setThreads(prev =>
      prev.map(t => {
        if (t.id === threadId) {
          const messages = t.messages.map(m =>
            m.id === messageId ? { ...m, text, parts: [{ type: 'text' as const, text }] } : m
          )
          return { ...t, messages }
        }
        return t
      })
    )
  }, [])

  const truncateThreadAfter = useCallback((threadId: string, messageId: string) => {
    setThreads(prev =>
      prev.map(t => {
        if (t.id === threadId) {
          const messageIndex = t.messages.findIndex(m => m.id === messageId)
          if (messageIndex === -1) return t

          // Keep everything up to and including the message
          return { ...t, messages: t.messages.slice(0, messageIndex + 1) }
        }
        return t
      })
    )
  }, [])

  // New: Update message parts for UIMessage streaming
  const updateMessageParts = useCallback(
    (threadId: string, messageId: string, parts: MessagePart[]) => {
      setThreads(prev =>
        prev.map(t => {
          if (t.id !== threadId) return t
          const messages = t.messages.map(m => {
            if (m.id !== messageId) return m
            const text = getTextFromParts(parts)
            return { ...m, parts, text }
          })
          return { ...t, messages }
        })
      )
    },
    []
  )

  return {
    threads,
    activeThreadId,
    activeThread,
    setThreads,
    setActiveThreadId,
    addThread,
    updateThreadId,
    deleteThread,
    addMessageToThread,
    replaceMessageId,
    appendToLastMessage,
    updateLastMessage,
    replaceLastMessage,
    updateMessageToThread,
    truncateThreadAfter,
    updateMessageParts,
  }
}
