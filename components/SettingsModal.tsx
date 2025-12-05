import { Check, ChevronDown, Loader2, RefreshCw, Save, X } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"
import { AiProvider, AppSettings } from "../types"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentSettings: AppSettings
  onSave: (settings: AppSettings) => void
}

const PROVIDERS: { id: AiProvider; name: string }[] = [
  { id: "google", name: "Google Gemini" },
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic Claude" },
  { id: "ollama", name: "Ollama (Local)" },
]

const API_KEY_LINKS: Record<AiProvider, { url: string; label: string } | null> = {
  google: { url: "https://aistudio.google.com/apikey", label: "Get API key" },
  openai: { url: "https://platform.openai.com/api-keys", label: "Get API key" },
  anthropic: { url: "https://console.anthropic.com/settings/keys", label: "Get API key" },
  ollama: { url: "https://ollama.readthedocs.io/en/api/", label: "Ollama docs" },
}

const API_KEYS_STORAGE_KEY = "threaded-api-keys"

// API Response types for model listing
interface GoogleModelsResponse {
  models?: Array<{ name: string }>
}

interface OpenAIModelsResponse {
  data?: Array<{ id: string }>
}

interface AnthropicModelsResponse {
  data?: Array<{ id: string }>
}

function getStoredApiKeys(): Partial<Record<AiProvider, string>> {
  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveApiKeyForProvider(provider: AiProvider, apiKey: string): void {
  const keys = getStoredApiKeys()
  keys[provider] = apiKey
  localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys))
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSave,
}) => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings)

  // Model List State
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isModelListOpen, setIsModelListOpen] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings)
      setAvailableModels([])
    }
  }, [isOpen, currentSettings])

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelListOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!isOpen) return null

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as AiProvider
    let newBaseUrl = ""
    if (newProvider === "openai") newBaseUrl = "https://api.openai.com/v1"
    if (newProvider === "ollama") newBaseUrl = "http://localhost:11434/v1"

    // Save current API key before switching
    if (settings.apiKey) {
      saveApiKeyForProvider(settings.provider, settings.apiKey)
    }

    // Load stored API key for new provider
    const storedKeys = getStoredApiKeys()
    const storedApiKey = storedKeys[newProvider] || ""

    setSettings(prev => ({
      ...prev,
      provider: newProvider,
      modelId: "",
      baseUrl: newBaseUrl,
      apiKey: storedApiKey,
    }))
    setAvailableModels([])
  }

  const fetchModels = async () => {
    if (!settings.apiKey && settings.provider !== "ollama") return

    setIsLoadingModels(true)
    let fetched: string[] = []

    try {
      if (settings.provider === "google") {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.apiKey}`
        )
        const data: GoogleModelsResponse = await response.json()
        if (data.models) {
          fetched = data.models.map(m => m.name.replace("models/", ""))
        }
      } else if (settings.provider === "openai" || settings.provider === "ollama") {
        const baseUrl =
          settings.baseUrl ||
          (settings.provider === "openai"
            ? "https://api.openai.com/v1"
            : "http://localhost:11434/v1")
        const headers: Record<string, string> = {}
        if (settings.apiKey) {
          headers["Authorization"] = `Bearer ${settings.apiKey}`
        }

        const response = await fetch(`${baseUrl}/models`, { headers })
        const data: OpenAIModelsResponse = await response.json()
        if (data.data) {
          fetched = data.data.map(m => m.id)
        }
      } else if (settings.provider === "anthropic") {
        const response = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": settings.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
        })
        const data: AnthropicModelsResponse = await response.json()
        if (data.data) {
          fetched = data.data.map(m => m.id)
        }
      }
    } catch (error) {
      console.error("Error fetching models:", error)
    }

    if (fetched.length > 0) {
      // Filter models by provider-specific patterns
      const filterPatterns: Record<AiProvider, RegExp | null> = {
        google: /^(gemini|gemma)/i,
        openai: /^gpt/i,
        anthropic: /^claude/i,
        ollama: null, // No filter for local models
      }

      const pattern = filterPatterns[settings.provider]
      const filtered = pattern ? fetched.filter(m => pattern.test(m)) : fetched
      const uniqueModels = Array.from(new Set(filtered.length > 0 ? filtered : fetched))

      setAvailableModels(uniqueModels)
      setIsModelListOpen(true)

      // Auto-select first model from fetched list
      if (uniqueModels.length > 0) {
        setSettings(prev => ({ ...prev, modelId: uniqueModels[0] }))
      }
    }

    setIsLoadingModels(false)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    // Save API key for current provider
    if (settings.apiKey) {
      saveApiKeyForProvider(settings.provider, settings.apiKey)
    }
    onSave(settings)
    onClose()
  }

  // Filter models based on input
  const filteredModels = availableModels.filter(m =>
    m.toLowerCase().includes(settings.modelId.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-dark-border">
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Model Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-dark-elevated rounded-full text-slate-500 dark:text-zinc-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Provider Select */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              AI Provider
            </label>
            <div className="relative">
              <select
                value={settings.provider}
                onChange={handleProviderChange}
                className="w-full appearance-none bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border text-slate-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-zinc-400">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              API Key{" "}
              {settings.provider === "ollama" && (
                <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span>
              )}
            </label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder={
                settings.provider === "ollama"
                  ? "Optional for local Ollama"
                  : `Enter your ${PROVIDERS.find(p => p.id === settings.provider)?.name} API Key`
              }
              className="w-full bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border text-slate-900 dark:text-zinc-100 placeholder:dark:text-zinc-500 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">
              {API_KEY_LINKS[settings.provider] && (
                <>
                  <a
                    href={API_KEY_LINKS[settings.provider]!.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-600 dark:text-accent hover:underline"
                  >
                    {API_KEY_LINKS[settings.provider]!.label} →
                  </a>
                  <span className="mx-1.5">·</span>
                </>
              )}
              Keys are stored locally in your browser.
              {settings.provider === "ollama" && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  Enable CORS: OLLAMA_ORIGINS=* ollama serve
                </span>
              )}
            </p>
          </div>

          {/* Model Name (Searchable Combobox) */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Model Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={settings.modelId}
                onChange={e => {
                  setSettings({ ...settings, modelId: e.target.value })
                  setIsModelListOpen(true)
                }}
                onFocus={() => setIsModelListOpen(true)}
                placeholder="e.g. gpt-4o, gemini-1.5-flash, llama3.2"
                className="w-full bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border text-slate-900 dark:text-zinc-100 placeholder:dark:text-zinc-500 rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
              <button
                type="button"
                onClick={fetchModels}
                disabled={(!settings.apiKey && settings.provider !== "ollama") || isLoadingModels}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-accent disabled:opacity-50 disabled:hover:text-slate-400 transition-colors"
                title="Fetch models from provider"
              >
                {isLoadingModels ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
              </button>
            </div>

            {/* Dropdown List */}
            {isModelListOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {filteredModels.length > 0 ? (
                  filteredModels.map(model => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => {
                        setSettings({ ...settings, modelId: model })
                        setIsModelListOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 flex items-center justify-between"
                    >
                      <span>{model}</span>
                      {settings.modelId === model && <Check size={14} className="text-accent" />}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 text-center">
                    No matching models found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Base URL (Optional for OpenAI, Required for Ollama) */}
          {(settings.provider === "openai" || settings.provider === "ollama") && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Base URL{" "}
                <span className="text-slate-400 dark:text-zinc-500 font-normal">
                  {settings.provider === "ollama" ? "(Required)" : "(Optional)"}
                </span>
              </label>
              <input
                type="text"
                value={settings.baseUrl || ""}
                onChange={e => setSettings({ ...settings, baseUrl: e.target.value })}
                placeholder={
                  settings.provider === "ollama"
                    ? "http://localhost:11434/v1"
                    : "https://api.openai.com/v1"
                }
                className="w-full bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border text-slate-900 dark:text-zinc-100 placeholder:dark:text-zinc-500 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-accent-muted hover:bg-accent text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SettingsModal
