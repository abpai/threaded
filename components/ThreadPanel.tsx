import React, { useRef, useEffect, useState, lazy, Suspense } from "react"
import {
  Send,
  X,
  Bot,
  User,
  Sparkles,
  ChevronLeft,
  Trash2,
  RefreshCw,
  AlertCircle,
  Settings,
} from "lucide-react"
import { Thread } from "../types"

const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"))

interface ThreadPanelProps {
  thread: Thread | null
  isLoading: boolean
  onClose: () => void
  onBack: () => void
  onSendMessage: (text: string) => void
  onDelete: () => void
  onRetry?: () => void
  onOpenSettings?: () => void
}

const isErrorMessage = (text: string): boolean => {
  return text.startsWith("Error:")
}

const shouldShowSettingsButton = (text: string): boolean => {
  const lowerText = text.toLowerCase()
  return (
    lowerText.includes("settings") || lowerText.includes("api key") || lowerText.includes("model")
  )
}

const ThreadPanel: React.FC<ThreadPanelProps> = ({
  thread,
  isLoading,
  onClose,
  onBack,
  onSendMessage,
  onDelete,
  onRetry,
  onOpenSettings,
}) => {
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [thread?.messages, isLoading])

  useEffect(() => {
    if (thread?.id) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [thread?.id])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return
    onSendMessage(inputValue)
    setInputValue("")
  }

  if (!thread) {
    return null
  }

  const isGeneralThread = thread.context === "Entire Document"

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-surface transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-sm z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-dark-elevated rounded-full text-slate-500 dark:text-zinc-400 transition-colors group"
            title="Back to all threads"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-zinc-100 leading-tight">
              Thread
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-[200px]">
              {isGeneralThread ? "General Discussion" : `Re: ${thread.snippet}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
            title="Delete thread"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-dark-elevated rounded-full text-slate-500 dark:text-zinc-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 dark:bg-dark-base/50">
        {/* Context Card - Only show if not a general thread */}
        {!isGeneralThread && (
          <div className="bg-white dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-lg p-4 shadow-sm text-sm relative">
            <div className="absolute -left-3 top-4 w-3 h-px bg-slate-200 dark:bg-dark-border"></div>
            <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
              Selected Context
            </p>
            <blockquote className="text-slate-600 dark:text-zinc-300 italic border-l-2 border-accent pl-3">
              "{thread.context}"
            </blockquote>
          </div>
        )}

        {thread.messages.map((msg, index) => {
          const isError = msg.role === "model" && isErrorMessage(msg.text)
          const isLastMessage = index === thread.messages.length - 1

          if (isLastMessage && isLoading && msg.role === "model" && !msg.text) {
            return null
          }

          return (
            <div
              key={index}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "user"
                    ? "bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-200"
                    : isError
                      ? "bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400"
                      : "bg-cyan-100 dark:bg-accent-glow text-cyan-600 dark:text-accent"
                }`}
              >
                {msg.role === "user" ? (
                  <User size={16} />
                ) : isError ? (
                  <AlertCircle size={16} />
                ) : (
                  <Bot size={16} />
                )}
              </div>
              <div className="flex flex-col gap-2 max-w-[85%]">
                <div
                  className={`rounded-2xl p-3 text-sm leading-relaxed shadow-sm overflow-hidden ${
                    msg.role === "user"
                      ? "bg-slate-800 dark:bg-zinc-700 text-white rounded-tr-none"
                      : isError
                        ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-tl-none"
                        : "bg-white dark:bg-dark-elevated border border-slate-100 dark:border-dark-border text-slate-700 dark:text-zinc-200 rounded-tl-none markdown-chat"
                  }`}
                >
                  {msg.role === "user" ? (
                    msg.text
                  ) : isError ? (
                    <span>{msg.text.replace("Error: ", "")}</span>
                  ) : (
                    <Suspense fallback={<span className="text-slate-400">...</span>}>
                      <MarkdownRenderer content={msg.text} />
                    </Suspense>
                  )}
                </div>
                {isError && isLastMessage && (
                  <div className="flex items-center gap-3 self-start">
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-accent dark:text-zinc-400 dark:hover:text-accent transition-colors"
                      >
                        <RefreshCw size={12} />
                        <span>Retry</span>
                      </button>
                    )}
                    {onOpenSettings && shouldShowSettingsButton(msg.text) && (
                      <button
                        onClick={onOpenSettings}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-accent dark:text-zinc-400 dark:hover:text-accent transition-colors"
                      >
                        <Settings size={12} />
                        <span>Open Settings</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-accent-glow text-cyan-600 dark:text-accent flex items-center justify-center shrink-0 animate-pulse">
              <Sparkles size={16} />
            </div>
            <div className="bg-white dark:bg-dark-elevated border border-slate-100 dark:border-dark-border p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
              <div
                className="w-2 h-2 bg-accent rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-accent rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-accent rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-100 dark:border-dark-border bg-white dark:bg-dark-surface">
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={isGeneralThread ? "Ask about the document..." : "Ask a follow-up..."}
            className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border text-slate-900 dark:text-zinc-100 placeholder:dark:text-zinc-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-accent-muted text-white rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}

export default ThreadPanel
