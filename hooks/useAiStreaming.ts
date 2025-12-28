import { useState, useCallback, useRef } from 'react'
import {
  streamThreadResponseWithParts,
  convertUIMessageParts,
  AIError,
  ThreadMode,
} from '../services/aiService'
import { AppSettings, Message, MessagePart, getTextFromParts } from '../types'
import { UseSessionResult } from './useSession'
import { generateId } from '../lib/id'

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
  updateMessageParts: (threadId: string, messageId: string, parts: MessagePart[]) => void
}

export interface UseAiStreamingResult {
  isLoading: boolean
  streamResponse: (options: StreamOptions) => Promise<string | null>
}

export function useAiStreaming(
  settings: AppSettings,
  threadManager: ThreadManagerLike,
  session?: UseSessionResult | null
): UseAiStreamingResult {
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const streamResponse = useCallback(
    async (options: StreamOptions): Promise<string | null> => {
      const { threadId, context, markdownContent, messages, userMessage, mode } = options

      // Abort any previous stream
      abortControllerRef.current?.abort()
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Add placeholder AI message with empty parts
      const placeholderId = generateId()
      threadManager.addMessageToThread(threadId, {
        id: placeholderId,
        role: 'assistant',
        parts: [],
        text: '',
        timestamp: Date.now(),
      })

      setIsLoading(true)
      let finalParts: MessagePart[] = []

      try {
        // Use the new UIMessage streaming with tool support
        for await (const uiMessage of streamThreadResponseWithParts(
          context,
          markdownContent,
          messages,
          userMessage,
          settings,
          mode,
          abortController.signal
        )) {
          // Check if aborted before processing
          if (abortController.signal.aborted) break

          // Convert and update parts
          const parts = convertUIMessageParts(uiMessage)
          finalParts = parts
          threadManager.updateMessageParts(threadId, placeholderId, parts)
        }

        const fullResponse = getTextFromParts(finalParts)

        // Save to API if session exists (addMessage handles fork for non-owners)
        if (session && fullResponse) {
          const savedId = await session.addMessage(threadId, 'assistant', fullResponse)
          if (savedId && savedId !== placeholderId) {
            threadManager.replaceMessageId(threadId, placeholderId, savedId)
          }
        }

        return fullResponse
      } catch (error) {
        const aiError = error as AIError
        const errorParts: MessagePart[] = [{ type: 'text', text: `Error: ${aiError.message}` }]
        threadManager.updateMessageParts(threadId, placeholderId, errorParts)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [settings, threadManager, session]
  )

  return { isLoading, streamResponse }
}
