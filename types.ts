// Message part types matching AI SDK UIMessage format
export interface TextPart {
  type: 'text'
  text: string
}

export interface ToolInvocationPart {
  type: 'tool-invocation'
  toolInvocationId: string
  toolName: string
  args: Record<string, unknown>
  state: 'partial-call' | 'call' | 'result'
  result?: unknown
}

export type MessagePart = TextPart | ToolInvocationPart

export interface Message {
  id: string
  role: 'user' | 'assistant' // Changed from "model" to match AI SDK
  parts: MessagePart[]
  text: string // Computed from text parts, kept for backwards compat
  timestamp: number
}

// Helper to compute text from parts
export function getTextFromParts(parts: MessagePart[]): string {
  return parts
    .filter((p): p is TextPart => p.type === 'text')
    .map(p => p.text)
    .join('')
}

export interface Thread {
  id: string
  context: string // The selected text that started the thread
  messages: Message[]
  createdAt: number
  snippet: string // Short preview of context for the list
}

export interface Quote {
  id: string
  text: string
  savedAt: number
}

export interface TextSelection {
  text: string
  rect: DOMRect | null
}

export enum ViewState {
  START = 'START',
  READING = 'READING',
  QUOTES = 'QUOTES',
}

export type AiProvider = 'google' | 'openai' | 'anthropic' | 'ollama'

export interface AppSettings {
  provider: AiProvider
  apiKey: string
  baseUrl?: string
  modelId: string
}

export interface SourceMetadata {
  type: 'file' | 'url' | 'paste'
  name?: string // filename or URL
}

export interface SessionMeta {
  id: string
  title: string
  summary: string | null
  lastModified: number
}
