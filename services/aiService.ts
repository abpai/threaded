import { streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { Message, AppSettings } from "../types"
import { getSystemPrompt, getSummaryPrompt } from "./prompts"

export type ThreadMode = "discuss" | "explain"

export interface AIError {
  type: "no_key" | "invalid_key" | "invalid_model" | "rate_limit" | "network" | "unknown"
  message: string
  canRetry: boolean
  shouldOpenSettings: boolean
}

function getModel(settings: AppSettings) {
  const modelId = settings.modelId
  if (!modelId) {
    throw new Error("No model selected. Please select a model in Settings.")
  }

  switch (settings.provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.baseUrl || undefined,
      })
      return openai(modelId)
    }
    case "ollama": {
      const openai = createOpenAI({
        apiKey: "ollama", // Required but ignored by Ollama
        baseURL: settings.baseUrl || "http://localhost:11434/v1",
      })
      return openai(modelId)
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: settings.apiKey,
        headers: {
          "anthropic-dangerous-direct-browser-access": "true",
        },
      })
      return anthropic(modelId)
    }
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: settings.apiKey,
      })
      return google(modelId)
    }
    default:
      throw new Error("Provider not supported")
  }
}

function formatMessages(
  history: Message[],
  newMessage: string
): Array<{ role: "user" | "assistant"; content: string }> {
  const historyForChat = history.filter((msg, index) => {
    if (index === history.length - 1 && msg.role === "user" && msg.text === newMessage) {
      return false
    }
    return true
  })

  const messages: Array<{ role: "user" | "assistant"; content: string }> = historyForChat.map(
    msg => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.text,
    })
  )

  messages.push({ role: "user" as const, content: newMessage })

  return messages
}

function parseError(error: unknown): AIError {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const lowerMessage = errorMessage.toLowerCase()

  if (
    lowerMessage.includes("api key") ||
    lowerMessage.includes("apikey") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("401") ||
    lowerMessage.includes("invalid x-goog-api-key")
  ) {
    return {
      type: "invalid_key",
      message: "Your API key is invalid. Please check Settings.",
      canRetry: false,
      shouldOpenSettings: true,
    }
  }

  if (
    lowerMessage.includes("is not found") ||
    lowerMessage.includes("not supported") ||
    lowerMessage.includes("invalid model") ||
    lowerMessage.includes("does not exist") ||
    lowerMessage.includes("model not found")
  ) {
    return {
      type: "invalid_model",
      message: "Model not found. Please check your model name in Settings.",
      canRetry: false,
      shouldOpenSettings: true,
    }
  }

  if (
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("429") ||
    lowerMessage.includes("quota")
  ) {
    return {
      type: "rate_limit",
      message: "Rate limit reached. Please wait a moment and try again.",
      canRetry: true,
      shouldOpenSettings: false,
    }
  }

  if (
    lowerMessage.includes("network") ||
    lowerMessage.includes("fetch") ||
    lowerMessage.includes("connection") ||
    lowerMessage.includes("cors")
  ) {
    return {
      type: "network",
      message: "Network error. Check your connection and try again.",
      canRetry: true,
      shouldOpenSettings: false,
    }
  }

  return {
    type: "unknown",
    message: errorMessage || "An unexpected error occurred.",
    canRetry: true,
    shouldOpenSettings: false,
  }
}

export async function* streamThreadResponse(
  context: string,
  fullDocument: string,
  history: Message[],
  newMessage: string,
  settings: AppSettings,
  mode: ThreadMode = "discuss"
): AsyncGenerator<string, void, unknown> {
  if (!settings.apiKey && settings.provider !== "ollama") {
    throw {
      type: "no_key",
      message: "Please add your API key in Settings.",
      canRetry: false,
      shouldOpenSettings: true,
    } as AIError
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
    console.error("AI Service Error:", error)
    throw parseError(error)
  }
}

export async function generateThreadResponse(
  context: string,
  fullDocument: string,
  history: Message[],
  newMessage: string,
  settings: AppSettings,
  mode: ThreadMode = "discuss"
): Promise<string> {
  let result = ""

  try {
    for await (const chunk of streamThreadResponse(
      context,
      fullDocument,
      history,
      newMessage,
      settings,
      mode
    )) {
      result += chunk
    }
    return result
  } catch (error) {
    if ((error as AIError).type) {
      return `Error: ${(error as AIError).message}`
    }
    return "Sorry, I encountered an error while communicating with the AI."
  }
}

export async function generateSessionSummary(
  document: string,
  settings: AppSettings
): Promise<string | null> {
  if (!settings.apiKey && settings.provider !== "ollama") {
    return null
  }

  try {
    const model = getModel(settings)
    const systemPrompt = getSummaryPrompt(document)

    const result = streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: "Summarize this document." }],
    })

    let summary = ""
    for await (const chunk of result.textStream) {
      summary += chunk
    }

    return summary.trim().slice(0, 100)
  } catch (error) {
    console.error("Failed to generate summary:", error)
    return null
  }
}
