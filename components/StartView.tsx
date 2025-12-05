import {
  ArrowRight,
  FileText,
  History,
  Link,
  Loader2,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Upload,
} from "lucide-react"
import React, { FormEvent, useRef, useState } from "react"
import { parseFile, parseUrl } from "../services/contentParser"
import { AppSettings, SourceMetadata } from "../types"
import SettingsModal from "./SettingsModal"

interface StartViewProps {
  onContentReady: (content: string, source?: SourceMetadata) => void
  settings: AppSettings
  onSaveSettings: (settings: AppSettings) => void
  isDarkMode: boolean
  onToggleDarkMode: () => void
  onToggleHistory?: () => void
}

type InputMode = "upload" | "link" | "paste"

const StartView: React.FC<StartViewProps> = ({
  onContentReady,
  settings,
  onSaveSettings,
  isDarkMode,
  onToggleDarkMode,
  onToggleHistory,
}) => {
  const [inputMode, setInputMode] = useState<InputMode>("upload")
  const [pasteContent, setPasteContent] = useState("")
  const [urlInput, setUrlInput] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const processFile = async (file: File) => {
    setError(null)
    setIsProcessing(true)
    setProcessingStatus(`Processing ${file.name}...`)

    try {
      const result = await parseFile(file)
      onContentReady(result.markdown, { type: "file", name: file.name })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process file")
      setIsProcessing(false)
    }
  }

  const handleUrlSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return

    setError(null)
    setIsProcessing(true)
    setProcessingStatus("Fetching content...")

    try {
      const result = await parseUrl(urlInput)
      onContentReady(result.markdown, { type: "url", name: urlInput })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch URL")
      setIsProcessing(false)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer?.types.includes("Files")) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    const file = e.dataTransfer?.files[0]
    if (file) {
      processFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
    e.target.value = ""
  }

  const handleStart = () => {
    if (pasteContent.trim()) {
      onContentReady(pasteContent, { type: "paste" })
    }
  }

  const handleSubmit = () => {
    if (inputMode === "paste" && pasteContent.trim()) {
      handleStart()
    }
  }

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-white dark:from-dark-surface dark:to-dark-base flex items-center justify-center transition-colors duration-300">
        <div className="text-center">
          <Loader2
            className="animate-spin mx-auto mb-4 text-emerald-600 dark:text-accent"
            size={32}
          />
          <p className="text-slate-600 dark:text-zinc-400">{processingStatus}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-white dark:from-dark-surface dark:to-dark-base flex flex-col items-center justify-center p-4 transition-colors duration-300"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 bg-accent/10 border-4 border-dashed border-accent z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-xl">
            <Upload className="mx-auto mb-4 text-emerald-600 dark:text-accent" size={48} />
            <p className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
              Drop file here
            </p>
          </div>
        </div>
      )}

      {onToggleHistory && (
        <div className="absolute top-4 left-4">
          <button
            onClick={onToggleHistory}
            className="p-2 rounded-full hover:bg-white/60 dark:hover:bg-dark-elevated text-slate-500 dark:text-zinc-400 transition-colors"
            title="History"
          >
            <History size={20} />
          </button>
        </div>
      )}

      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-full hover:bg-white/60 dark:hover:bg-dark-elevated text-slate-500 dark:text-zinc-400 transition-colors"
        >
          <SettingsIcon size={20} />
        </button>
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-full hover:bg-white/60 dark:hover:bg-dark-elevated text-slate-500 dark:text-zinc-400 transition-colors"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-accent-glow mb-6">
            <svg viewBox="0 0 32 32" className="w-7 h-7 text-emerald-600 dark:text-accent">
              <path
                d="M8 8 L24 8 M16 8 L16 24"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="8" cy="8" r="2.5" fill="currentColor" />
              <circle cx="24" cy="8" r="2.5" fill="currentColor" />
              <circle cx="16" cy="24" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-4xl font-serif font-semibold text-slate-900 dark:text-zinc-100 mb-3">
            Threaded Reader
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 text-lg">
            Read deeper with AI.
            <br />
            Turn any document into a conversation.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-dark-border p-6">
          {/* Tabs */}
          <div className="flex rounded-full bg-slate-100 dark:bg-dark-elevated p-1 mb-6">
            <button
              onClick={() => setInputMode("upload")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
                inputMode === "upload"
                  ? "bg-white dark:bg-zinc-600 text-slate-900 dark:text-zinc-100 shadow-sm"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              }`}
            >
              <Upload size={16} />
              Upload
            </button>
            <button
              onClick={() => setInputMode("link")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
                inputMode === "link"
                  ? "bg-white dark:bg-zinc-600 text-slate-900 dark:text-zinc-100 shadow-sm"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              }`}
            >
              <Link size={16} />
              Link
            </button>
            <button
              onClick={() => setInputMode("paste")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
                inputMode === "paste"
                  ? "bg-white dark:bg-zinc-600 text-slate-900 dark:text-zinc-100 shadow-sm"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              }`}
            >
              <FileText size={16} />
              Paste
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Content panels with smooth transitions */}
          <div className="relative min-h-[220px]">
            {/* Upload Panel */}
            <div
              className={`absolute inset-0 transition-all duration-200 ease-out ${
                inputMode === "upload"
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-2 pointer-events-none"
              }`}
            >
              <div className="border-2 border-dashed border-slate-200 dark:border-dark-border rounded-xl p-10 text-center hover:border-emerald-300 dark:hover:border-accent-muted transition-colors h-full flex flex-col items-center justify-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-dark-elevated mb-4">
                  <Upload className="text-slate-400 dark:text-zinc-500" size={24} />
                </div>
                <p className="text-slate-600 dark:text-zinc-400 mb-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-emerald-600 dark:text-accent hover:underline font-medium"
                  >
                    Click to upload
                  </button>{" "}
                  or drag and drop
                </p>
                <p className="text-sm text-slate-400 dark:text-zinc-500">
                  Markdown, Text, PDF, DOCX
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.txt,.pdf,.docx,.xlsx,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Link Panel */}
            <div
              className={`absolute inset-0 transition-all duration-200 ease-out ${
                inputMode === "link"
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-2 pointer-events-none"
              }`}
            >
              <form
                onSubmit={handleUrlSubmit}
                className="space-y-4 h-full flex flex-col justify-center"
              >
                <input
                  type="url"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated text-slate-900 dark:text-zinc-100 placeholder:dark:text-zinc-500 focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent/20 focus:border-emerald-500 dark:focus:border-accent outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="w-full py-3.5 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium transition-all flex items-center justify-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 dark:hover:bg-white"
                >
                  <span>Fetch Content</span>
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
              </form>
            </div>

            {/* Paste Panel */}
            <div
              className={`absolute inset-0 transition-all duration-200 ease-out ${
                inputMode === "paste"
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-2 pointer-events-none"
              }`}
            >
              <div className="space-y-4">
                <textarea
                  value={pasteContent}
                  onChange={e => setPasteContent(e.target.value)}
                  placeholder="Paste your markdown content here..."
                  className="w-full h-[156px] p-4 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated text-slate-900 dark:text-zinc-100 placeholder:dark:text-zinc-500 focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent/20 focus:border-emerald-500 dark:focus:border-accent outline-none transition-all font-mono text-sm resize-none"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!pasteContent.trim()}
                  className="w-full py-3.5 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium transition-all flex items-center justify-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 dark:hover:bg-white"
                >
                  <span>Start Reading</span>
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-slate-400 dark:text-zinc-600 text-sm">
          ❤️ Built with Gemini, Codex & Claude
        </p>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings}
        onSave={onSaveSettings}
      />
    </div>
  )
}

export default StartView
