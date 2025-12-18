import { Check, CheckCircle2, ChevronDown, Loader2, RefreshCw, Save, X } from "lucide-react"
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
  models?: Array<{
    name: string
    supportedGenerationMethods?: string[]
  }>
}

interface OpenAIModelsResponse {
  data?: Array<{
    id: string
    created: number
  }>
}

interface AnthropicModelsResponse {
  data?: Array<{
    id: string
    created_at?: string
  }>
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
  const [isValidated, setIsValidated] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings)
      setAvailableModels([])
      setIsValidated(currentSettings.provider === "ollama")

      // Auto-validate if key exists
      if (currentSettings.apiKey && currentSettings.provider !== "ollama") {
        fetchModels(currentSettings)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setIsValidated(newProvider === "ollama")
  }

  const fetchModels = async (settingsOverride?: AppSettings) => {
    const activeSettings = settingsOverride || settings

    if (!activeSettings.apiKey && activeSettings.provider !== "ollama") {
      setIsValidated(false)
      return
    }

    setIsLoadingModels(true)
    setIsValidated(false)
    let fetched: { id: string; created?: number; created_at?: string }[] = []

    try {
      if (activeSettings.provider === "google") {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${activeSettings.apiKey}`
        )
        if (!response.ok) throw new Error("Failed to fetch models")
        const data: GoogleModelsResponse = await response.json()
        if (data.models) {
          fetched = data.models
            .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
            .map(m => ({ id: m.name.replace("models/", "") }))
        }
      } else if (activeSettings.provider === "openai" || activeSettings.provider === "ollama") {
        const baseUrl =
          activeSettings.baseUrl ||
          (activeSettings.provider === "openai"
            ? "https://api.openai.com/v1"
            : "http://localhost:11434/v1")
        const headers: Record<string, string> = {}
        if (activeSettings.apiKey) {
          headers["Authorization"] = `Bearer ${activeSettings.apiKey}`
        }

        const response = await fetch(`${baseUrl}/models`, { headers })
        if (!response.ok) throw new Error("Failed to fetch models")
        const data: OpenAIModelsResponse = await response.json()
        if (data.data) {
          fetched = data.data.map(m => ({ id: m.id, created: m.created }))
        }
      } else if (activeSettings.provider === "anthropic") {
        const response = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": activeSettings.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
        })
        if (!response.ok) throw new Error("Failed to fetch models")
        const data: AnthropicModelsResponse = await response.json()
        if (data.data) {
          fetched = data.data.map(m => ({ id: m.id, created_at: m.created_at }))
        }
      }
      setIsValidated(true)
    } catch (error) {
      console.error("Error fetching models:", error)
      setIsValidated(false)
    }

    if (fetched.length > 0) {
      // Filter and Sort
      let filtered = fetched

      if (activeSettings.provider === "google") {
        filtered = fetched.filter(m => m.id.toLowerCase().includes("gemini"))
      } else if (activeSettings.provider === "openai") {
        filtered = fetched
          .filter(m => m.id.toLowerCase().startsWith("gpt"))
          .sort((a, b) => (b.created || 0) - (a.created || 0))
      } else if (activeSettings.provider === "anthropic") {
        filtered = fetched
          .filter(m => m.id.toLowerCase().includes("claude"))
          .sort((a, b) => {
            if (!a.created_at) return 1
            if (!b.created_at) return -1
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
      }

      const uniqueModels = Array.from(new Set(filtered.map(m => m.id)))

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
            <div className="relative">
              <input
                type="password"
                value={settings.apiKey}
                onChange={e => {
                  setSettings({ ...settings, apiKey: e.target.value })
                  setIsValidated(false)
                }}
                onBlur={() => fetchModels()}
                placeholder={
                  settings.provider === "ollama"
                    ? "Optional for local Ollama"
                    : `Enter your ${PROVIDERS.find(p => p.id === settings.provider)?.name} API Key`
                }
                className={`w-full bg-slate-50 dark:bg-dark-elevated border text-slate-900 dark:text-zinc-100 placeholder:dark:text-zinc-500 rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 transition-all ${
                  isValidated
                    ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/20"
                    : "border-slate-200 dark:border-dark-border focus:ring-accent/50 focus:border-accent"
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200">
                {isLoadingModels ? (
                  <Loader2 size={18} className="animate-spin text-slate-400" />
                ) : isValidated ? (
                  <CheckCircle2 size={18} className="text-green-500 animate-in zoom-in" />
                ) : null}
              </div>
            </div>
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
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isValidated || settings.provider === "ollama"
                ? "max-h-[200px] opacity-100 translate-y-0"
                : "max-h-0 opacity-0 -translate-y-2"
            }`}
          >
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
                  onClick={() => fetchModels()}
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
          </div>

          {/* Base URL (Optional for OpenAI, Required for Ollama) */}
          {((settings.provider === "openai" && isValidated) || settings.provider === "ollama") && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
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
