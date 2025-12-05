export interface Message {
  role: "user" | "model"
  text: string
  timestamp: number
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
  START = "START",
  READING = "READING",
  QUOTES = "QUOTES",
}

export type AiProvider = "google" | "openai" | "anthropic" | "ollama"

export interface AppSettings {
  provider: AiProvider
  apiKey: string
  baseUrl?: string
  modelId: string
}

export interface SourceMetadata {
  type: "file" | "url" | "paste"
  name?: string // filename or URL
}

export interface SessionMeta {
  id: string
  title: string
  summary: string | null
  lastModified: number
}
