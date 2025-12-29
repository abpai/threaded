import { SiClaude, SiGooglegemini, SiOllama } from '@icons-pack/react-simple-icons'
import { Check, ChevronDown } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { DEFAULT_MODELS, DEFAULT_MODEL_ID } from '../lib/defaultModels'
import { AiProvider, AppSettings } from '../types'

interface ProviderModelSelectorProps {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
}

function OpenAIIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

const PROVIDERS: { id: AiProvider; name: string; icon: React.ReactNode }[] = [
  { id: 'google', name: 'Gemini', icon: <SiGooglegemini size={14} /> },
  { id: 'openai', name: 'OpenAI', icon: <OpenAIIcon /> },
  { id: 'anthropic', name: 'Claude', icon: <SiClaude size={14} /> },
  { id: 'ollama', name: 'Ollama', icon: <SiOllama size={14} /> },
]

function formatModelName(modelId: string): string {
  return modelId
    .replace(/-preview$/, '')
    .replace(/-latest$/, '')
    .replace(/^gemini-/, '')
    .replace(/^gpt-/, 'GPT ')
    .replace(/^claude-/, '')
    .replace(/-(\d)/, ' $1')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const ProviderModelSelector: React.FC<ProviderModelSelectorProps> = ({
  settings,
  onSettingsChange,
}) => {
  const [providerOpen, setProviderOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [providerPosition, setProviderPosition] = useState<'up' | 'down'>('down')
  const [modelPosition, setModelPosition] = useState<'up' | 'down'>('down')
  const providerRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)

  const currentProvider = PROVIDERS.find(p => p.id === settings.provider) || PROVIDERS[0]
  const availableModels = DEFAULT_MODELS[settings.provider] || []

  const calculatePosition = (ref: React.RefObject<HTMLDivElement | null>): 'up' | 'down' => {
    if (!ref.current) return 'up'
    const rect = ref.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    return spaceBelow < 200 ? 'up' : 'down'
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setProviderOpen(false)
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleProviderChange = (providerId: AiProvider) => {
    const newModelId = DEFAULT_MODEL_ID[providerId]
    onSettingsChange({
      ...settings,
      provider: providerId,
      modelId: newModelId,
    })
    setProviderOpen(false)
  }

  const handleModelChange = (modelId: string) => {
    onSettingsChange({
      ...settings,
      modelId,
    })
    setModelOpen(false)
  }

  return (
    <div className="flex items-center gap-2 pb-3">
      {/* Provider Dropdown */}
      <div ref={providerRef} className="relative">
        <button
          type="button"
          onClick={() => {
            if (!providerOpen) {
              setProviderPosition(calculatePosition(providerRef))
            }
            setProviderOpen(!providerOpen)
            setModelOpen(false)
          }}
          aria-haspopup="listbox"
          aria-expanded={providerOpen}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border hover:bg-slate-200 dark:hover:bg-dark-border text-slate-700 dark:text-zinc-300 transition-colors"
        >
          {currentProvider.icon}
          <span>{currentProvider.name}</span>
          <ChevronDown
            size={12}
            className={`transition-transform ${providerOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {providerOpen && (
          <div className={`absolute left-0 ${providerPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'} z-50 min-w-[140px] py-1 bg-white dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-lg shadow-lg`}>
            {PROVIDERS.map(provider => (
              <button
                key={provider.id}
                onClick={() => handleProviderChange(provider.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-100 dark:hover:bg-dark-border text-slate-700 dark:text-zinc-300 transition-colors"
              >
                <span className="w-4 flex justify-center">{provider.icon}</span>
                <span className="flex-1">{provider.name}</span>
                {settings.provider === provider.id && (
                  <Check size={12} className="text-accent" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model Dropdown */}
      <div ref={modelRef} className="relative">
        <button
          type="button"
          onClick={() => {
            if (!modelOpen) {
              setModelPosition(calculatePosition(modelRef))
            }
            setModelOpen(!modelOpen)
            setProviderOpen(false)
          }}
          aria-haspopup="listbox"
          aria-expanded={modelOpen}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border hover:bg-slate-200 dark:hover:bg-dark-border text-slate-700 dark:text-zinc-300 transition-colors"
        >
          <span>{formatModelName(settings.modelId)}</span>
          <ChevronDown
            size={12}
            className={`transition-transform ${modelOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {modelOpen && (
          <div className={`absolute left-0 ${modelPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'} z-50 min-w-[180px] py-1 bg-white dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-lg shadow-lg`}>
            {availableModels.map(modelId => (
              <button
                key={modelId}
                onClick={() => handleModelChange(modelId)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-100 dark:hover:bg-dark-border text-slate-700 dark:text-zinc-300 transition-colors"
              >
                <span>{formatModelName(modelId)}</span>
                {settings.modelId === modelId && (
                  <Check size={12} className="text-accent" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProviderModelSelector
