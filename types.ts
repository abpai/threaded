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

export interface TextSelection {
  text: string
  rect: DOMRect | null
}

export enum ViewState {
  START = "START",
  READING = "READING",
}

export type AiProvider = "google" | "openai" | "anthropic" | "ollama"

export interface AppSettings {
  provider: AiProvider
  apiKey: string
  baseUrl?: string
  modelId: string
}
