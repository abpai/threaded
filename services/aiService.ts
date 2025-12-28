import { streamText, readUIMessageStream, UIMessage, stepCountIs } from 'ai'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { createAnthropic, anthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI, google } from '@ai-sdk/google'
import { createOllama } from 'ai-sdk-ollama'
import { Message, MessagePart, ToolInvocationPart, AppSettings } from '../types'
import { getSystemPrompt, getSummaryPrompt } from './prompts'

export type ThreadMode = 'discuss' | 'explain'

export interface AIError {
  type: 'no_key' | 'invalid_key' | 'invalid_model' | 'rate_limit' | 'network' | 'unknown'
  message: string
  canRetry: boolean
  shouldOpenSettings: boolean
}

export class AIServiceError extends Error {
  type: AIError['type']
  canRetry: boolean
  shouldOpenSettings: boolean

  constructor(options: AIError) {
    super(options.message)
    this.name = 'AIServiceError'
    this.type = options.type
    this.canRetry = options.canRetry
    this.shouldOpenSettings = options.shouldOpenSettings
  }
}

function getModel(settings: AppSettings) {
  const { provider, apiKey, baseUrl, modelId } = settings

  if (!modelId) {
    throw new Error('No model selected. Please select a model in Settings.')
  }

  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey, baseURL: baseUrl })(modelId)

    case 'anthropic':
      return createAnthropic({
        apiKey,
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      })(modelId)

    case 'google':
      return createGoogleGenerativeAI({ apiKey })(modelId)

    case 'ollama':
      return createOllama({ baseURL: baseUrl || 'http://localhost:11434' })(modelId)

    default:
      throw new Error('Provider not supported')
  }
}

// Get provider-defined tools (web search) when available
function getProviderTools(settings: AppSettings): Record<string, unknown> | undefined {
  switch (settings.provider) {
    case 'anthropic':
      // Anthropic web search tool - requires enabling in Anthropic Console
      return { web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }) }
    case 'google':
      // Google Search grounding for Gemini
      return { google_search: google.tools.googleSearch({}) }
    case 'openai':
      // OpenAI web search tool
      return { web_search: openai.tools.webSearch() }
    default:
      // Ollama doesn't support provider tools
      return undefined
  }
}

// Type guard for tool invocation parts
interface ToolPart {
  type: string
  toolCallId: string
  state: string
  input?: unknown
  output?: unknown
}

function isToolPart(part: unknown): part is ToolPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'toolCallId' in part &&
    'type' in part &&
    'state' in part &&
    typeof (part as ToolPart).toolCallId === 'string'
  )
}

const MAX_TOOL_RESULT_CHARS = 2000

function serializeToolResult(result: unknown): string {
  if (result == null) return ''
  if (typeof result === 'string') return result
  try {
    return JSON.stringify(result, null, 2)
  } catch {
    return String(result)
  }
}

function normalizeToolError(output: unknown): unknown {
  if (output && typeof output === 'object' && 'error' in output) {
    return output
  }
  if (output instanceof Error) {
    return { error: true, message: output.message }
  }
  return {
    error: true,
    message: typeof output === 'string' ? output : 'Tool invocation failed',
  }
}

function getMessageContentForModel(msg: Message): string {
  if (!msg.parts || msg.parts.length === 0) return msg.text

  const text = msg.parts
    .filter(part => part.type === 'text')
    .map(part => (part.type === 'text' ? part.text : ''))
    .join('')

  const toolResults = msg.parts
    .filter(
      (part): part is ToolInvocationPart =>
        part.type === 'tool-invocation' && part.state === 'result'
    )
    .map(part => ({
      toolName: part.toolName,
      result: part.result,
    }))
    .filter(part => part.result !== undefined)

  if (toolResults.length === 0) return text

  const toolText = toolResults
    .map(({ toolName, result }) => {
      const serialized = serializeToolResult(result)
      const truncated =
        serialized.length > MAX_TOOL_RESULT_CHARS
          ? `${serialized.slice(0, MAX_TOOL_RESULT_CHARS)}... [truncated]`
          : serialized
      return `\n\n[Tool ${toolName} result]\n${truncated}`
    })
    .join('')

  return `${text}${toolText}`.trim()
}

// Convert UIMessage parts to our MessagePart format
export function convertUIMessageParts(uiMessage: UIMessage): MessagePart[] {
  const parts: MessagePart[] = []

  for (const part of uiMessage.parts) {
    if (part.type === 'text') {
      parts.push({
        type: 'text',
        text: part.text,
      })
    } else if (isToolPart(part)) {
      // Tool invocation parts have type like "tool-web_search"
      const toolName = part.type.replace('tool-', '')
      const toolCallId = part.toolCallId

      // Map AI SDK states to our simplified states
      let state: 'partial-call' | 'call' | 'result' = 'partial-call'
      if (part.state === 'input-available') {
        state = 'call'
      } else if (part.state === 'output-available' || part.state === 'output-error') {
        state = 'result'
      }

      parts.push({
        type: 'tool-invocation',
        toolInvocationId: toolCallId,
        toolName,
        args: (part.state === 'input-available' || part.state === 'input-streaming'
          ? part.input
          : {}) as Record<string, unknown>,
        state,
        result:
          part.state === 'output-available'
            ? part.output
            : part.state === 'output-error'
              ? normalizeToolError(part.output)
              : undefined,
      })
    }
  }

  return parts
}

function formatMessages(
  history: Message[],
  newMessage: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const historyForChat = history.filter((msg, index) => {
    if (index === history.length - 1 && msg.role === 'user' && msg.text === newMessage) {
      return false
    }
    return true
  })

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = historyForChat.map(
    msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: getMessageContentForModel(msg),
    })
  )

  messages.push({ role: 'user' as const, content: newMessage })

  return messages
}

function parseError(error: unknown): AIError {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const lowerMessage = errorMessage.toLowerCase()

  if (
    lowerMessage.includes('api key') ||
    lowerMessage.includes('apikey') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('401') ||
    lowerMessage.includes('invalid x-goog-api-key')
  ) {
    return {
      type: 'invalid_key',
      message: 'Your API key is invalid. Please check Settings.',
      canRetry: false,
      shouldOpenSettings: true,
    }
  }

  if (
    lowerMessage.includes('is not found') ||
    lowerMessage.includes('not supported') ||
    lowerMessage.includes('invalid model') ||
    lowerMessage.includes('does not exist') ||
    lowerMessage.includes('model not found')
  ) {
    return {
      type: 'invalid_model',
      message: 'Model not found. Please check your model name in Settings.',
      canRetry: false,
      shouldOpenSettings: true,
    }
  }

  if (
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('429') ||
    lowerMessage.includes('quota')
  ) {
    return {
      type: 'rate_limit',
      message: 'Rate limit reached. Please wait a moment and try again.',
      canRetry: true,
      shouldOpenSettings: false,
    }
  }

  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('cors')
  ) {
    return {
      type: 'network',
      message: 'Network error. Check your connection and try again.',
      canRetry: true,
      shouldOpenSettings: false,
    }
  }

  return {
    type: 'unknown',
    message: errorMessage || 'An unexpected error occurred.',
    canRetry: true,
    shouldOpenSettings: false,
  }
}

// New: Stream with UIMessage format for tool support
export async function* streamThreadResponseWithParts(
  context: string,
  fullDocument: string,
  history: Message[],
  newMessage: string,
  settings: AppSettings,
  mode: ThreadMode = 'discuss',
  abortSignal?: AbortSignal
): AsyncGenerator<UIMessage, void, unknown> {
  if (!settings.apiKey && settings.provider !== 'ollama') {
    throw new AIServiceError({
      type: 'no_key',
      message: 'Please add your API key in Settings.',
      canRetry: false,
      shouldOpenSettings: true,
    })
  }

  try {
    const model = getModel(settings)
    const systemPrompt = getSystemPrompt(context, fullDocument, mode)
    const messages = formatMessages(history, newMessage)
    const tools = getProviderTools(settings)

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
      stopWhen: tools ? stepCountIs(3) : undefined, // Allow up to 3 tool invocations when tools are available
      abortSignal,
    })

    for await (const uiMessage of readUIMessageStream({
      stream: result.toUIMessageStream(),
    })) {
      yield uiMessage
    }
  } catch (error) {
    console.error('AI Service Error:', error)
    throw parseError(error)
  }
}

// Legacy: Stream plain text (for backwards compatibility)
export async function* streamThreadResponse(
  context: string,
  fullDocument: string,
  history: Message[],
  newMessage: string,
  settings: AppSettings,
  mode: ThreadMode = 'discuss'
): AsyncGenerator<string, void, unknown> {
  if (!settings.apiKey && settings.provider !== 'ollama') {
    throw new AIServiceError({
      type: 'no_key',
      message: 'Please add your API key in Settings.',
      canRetry: false,
      shouldOpenSettings: true,
    })
  }

  try {
    const model = getModel(settings)
    const systemPrompt = getSystemPrompt(context, fullDocument, mode)
    const messages = formatMessages(history, newMessage)

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
    })

    for await (const chunk of result.textStream) {
      yield chunk
    }
  } catch (error) {
    console.error('AI Service Error:', error)
    throw parseError(error)
  }
}

export async function generateSessionSummary(
  document: string,
  settings: AppSettings
): Promise<string | null> {
  if (!settings.apiKey && settings.provider !== 'ollama') {
    return null
  }

  try {
    const model = getModel(settings)
    const systemPrompt = getSummaryPrompt(document)

    const result = streamText({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Summarize this document.' }],
    })

    let summary = ''
    for await (const chunk of result.textStream) {
      summary += chunk
    }

    return summary.trim().slice(0, 80)
  } catch (error) {
    console.error('Failed to generate summary:', error)
    return null
  }
}
