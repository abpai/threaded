import { useState, useCallback, useRef } from "react"
import { streamThreadResponse, AIError, ThreadMode } from "../services/aiService"
import { AppSettings, Message } from "../types"
import { UseSessionResult } from "./useSession"
import { generateId } from "../lib/id"

export interface StreamOptions {
  threadId: string
  context: string
  markdownContent: string
  messages: Message[]
  userMessage: string
  mode: ThreadMode
}

interface ThreadManagerLike {
  addMessageToThread: (threadId: string, message: Message) => void
  replaceMessageId: (threadId: string, oldId: string, newId: string) => void
  appendToLastMessage: (threadId: string, chunk: string) => void
  updateLastMessage: (threadId: string, text: string) => void
}

export interface UseAiStreamingResult {
  isLoading: boolean
  streamResponse: (options: StreamOptions) => Promise<string | null>
  abort: () => void
}

export function useAiStreaming(
  settings: AppSettings,
  threadManager: ThreadManagerLike,
  session?: UseSessionResult | null
): UseAiStreamingResult {
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef(false)

  const streamResponse = useCallback(
    async (options: StreamOptions): Promise<string | null> => {
      const { threadId, context, markdownContent, messages, userMessage, mode } = options

      // Add placeholder AI message
      const placeholderId = generateId()
      threadManager.addMessageToThread(threadId, {
        id: placeholderId,
        role: "model",
        text: "",
        timestamp: Date.now(),
      })

      setIsLoading(true)
      abortRef.current = false
      let fullResponse = ""

      try {
        for await (const chunk of streamThreadResponse(
          context,
          markdownContent,
          messages,
          userMessage,
          settings,
          mode
        )) {
          if (abortRef.current) break

          fullResponse += chunk
          threadManager.appendToLastMessage(threadId, chunk)
        }

        // Save to API if session exists (addMessage handles fork for non-owners)
        if (session && fullResponse) {
          const savedId = await session.addMessage(threadId, "model", fullResponse)
          if (savedId && savedId !== placeholderId) {
            threadManager.replaceMessageId(threadId, placeholderId, savedId)
          }
        }

        return fullResponse
      } catch (error) {
        const aiError = error as AIError
        threadManager.updateLastMessage(threadId, `Error: ${aiError.message}`)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [settings, threadManager, session]
  )

  const abort = useCallback(() => {
    abortRef.current = true
  }, [])

  return { isLoading, streamResponse, abort }
}
