import { useState, useCallback, useRef } from 'react'
import { generateThreadResponse, AIServiceError, ThreadMode } from '../services/aiService'
import { AppSettings, Message, MessagePart } from '../types'
import { UseSessionResult } from './useSession'
import { generateId } from '../lib/id'

export interface RequestOptions {
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
}

export interface UseAiRequestResult {
  isLoading: boolean
  sendRequest: (options: RequestOptions) => Promise<string | null>
}

export function useAiRequest(
  settings: AppSettings,
  threadManager: ThreadManagerLike,
  session?: UseSessionResult | null
): UseAiRequestResult {
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendRequest = useCallback(
    async (options: RequestOptions): Promise<string | null> => {
      const { threadId, context, markdownContent, messages, userMessage, mode } = options

      // Abort any previous request
      abortControllerRef.current?.abort()
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      setIsLoading(true)

      try {
        const { parts, text } = await generateThreadResponse(
          context,
          markdownContent,
          messages,
          userMessage,
          settings,
          mode,
          abortController.signal
        )

        // Check if aborted before adding message
        if (abortController.signal.aborted) return null

        // Create the AI message with final content
        const messageId = generateId()
        const aiMessage: Message = {
          id: messageId,
          role: 'assistant',
          parts,
          text,
          timestamp: Date.now(),
        }

        threadManager.addMessageToThread(threadId, aiMessage)

        // Save to API if session exists
        if (session && text) {
          const savedId = await session.addMessage(threadId, 'assistant', text)
          if (savedId && savedId !== messageId) {
            threadManager.replaceMessageId(threadId, messageId, savedId)
          }
        }

        return text
      } catch (error) {
        // Don't show error for user-initiated abort
        if (abortController.signal.aborted) return null

        const aiError = error as AIServiceError
        const errorParts: MessagePart[] = [{ type: 'text', text: `Error: ${aiError.message}` }]
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          parts: errorParts,
          text: `Error: ${aiError.message}`,
          timestamp: Date.now(),
        }
        threadManager.addMessageToThread(threadId, errorMessage)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [settings, threadManager, session]
  )

  return { isLoading, sendRequest }
}
