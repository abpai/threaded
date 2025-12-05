import { useState, useCallback, useMemo, Dispatch, SetStateAction } from "react"
import { Thread, Message } from "../types"

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
  appendToLastMessage: (threadId: string, chunk: string) => void
  updateLastMessage: (threadId: string, text: string) => void
  replaceLastMessage: (threadId: string, message: Message) => void
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

  const appendToLastMessage = useCallback((threadId: string, chunk: string) => {
    setThreads(prev =>
      prev.map(t => {
        if (t.id === threadId) {
          const messages = [...t.messages]
          const lastMessage = messages[messages.length - 1]
          if (lastMessage && lastMessage.role === "model") {
            messages[messages.length - 1] = {
              ...lastMessage,
              text: lastMessage.text + chunk,
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
          if (lastMessage && lastMessage.role === "model") {
            messages[messages.length - 1] = { ...lastMessage, text }
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
    appendToLastMessage,
    updateLastMessage,
    replaceLastMessage,
  }
}
