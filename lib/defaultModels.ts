import { AiProvider } from '../types'

export const DEFAULT_MODELS: Record<AiProvider, string[]> = {
  google: ['gemini-3-flash-preview', 'gemini-3-pro-preview'],
  openai: ['gpt-5.2-chat-latest', 'gpt-5-mini', 'gpt-5-nano'],
  anthropic: [
    'claude-opus-4-6',
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001',
  ],
  ollama: ['qwen3:8b', 'gpt-oss:20b', 'gemma3:latest'],
}

export const DEFAULT_MODEL_ID: Record<AiProvider, string> = {
  google: DEFAULT_MODELS.google[0],
  openai: DEFAULT_MODELS.openai[0],
  anthropic: DEFAULT_MODELS.anthropic[0],
  ollama: DEFAULT_MODELS.ollama[0],
}
