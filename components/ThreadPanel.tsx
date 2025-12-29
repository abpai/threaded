import React, { useRef, useEffect, useState, lazy, Suspense } from 'react'
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
  Pencil,
  Check,
  Copy,
} from 'lucide-react'
import { Thread, MessagePart } from '../types'
import ToolInvocationRenderer from './ToolInvocationRenderer'

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'))

interface ThreadPanelProps {
  thread: Thread | null
  isLoading: boolean
  onClose: () => void
  onBack: () => void
  onSendMessage: (text: string) => void
  onDelete: () => void
  onRetry?: () => void
  onOpenSettings?: () => void
  onUpdateMessage?: (messageId: string, newText: string) => void
  isReadOnly?: boolean
}

const isErrorMessage = (text: string): boolean => {
  return text.startsWith('Error:')
}

// Helper to get parts from message (backwards compat)
const getMessageParts = (parts?: MessagePart[], text?: string): MessagePart[] => {
  if (parts && parts.length > 0) return parts
  if (text) return [{ type: 'text', text }]
  return []
}

// Component to render message parts
const MessageContent: React.FC<{
  parts: MessagePart[]
  isStreaming: boolean
}> = ({ parts, isStreaming }) => {
  if (parts.length === 0 && isStreaming) {
    return <span className="text-slate-400 dark:text-zinc-500">...</span>
  }

  return (
    <>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          if (!part.text) return null
          if (isStreaming) {
            return (
              <span key={idx} className="whitespace-pre-wrap">
                {part.text}
              </span>
            )
          }
          return (
            <Suspense key={idx} fallback={<span className="text-slate-400">...</span>}>
              <MarkdownRenderer content={part.text} />
            </Suspense>
          )
        }
        if (part.type === 'tool-invocation') {
          return <ToolInvocationRenderer key={part.toolInvocationId} part={part} />
        }
        return null
      })}
    </>
  )
}

const shouldShowSettingsButton = (text: string): boolean => {
  const lowerText = text.toLowerCase()
  return (
    lowerText.includes('settings') || lowerText.includes('api key') || lowerText.includes('model')
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
  onUpdateMessage,
  isReadOnly = false,
}) => {
  const [inputValue, setInputValue] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editWidthPx, setEditWidthPx] = useState<number | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const messageBubbleRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollRafRef = useRef<number | null>(null)
  const prevIsLoadingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isNearBottom = () => {
    const el = messagesScrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const scheduleScrollToBottom = (behavior: 'auto' | 'smooth') => {
    if (scrollRafRef.current != null) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      messagesEndRef.current?.scrollIntoView({ behavior })
    })
  }

  const scrollMessageToTop = (messageId: string, behavior: 'auto' | 'smooth' = 'smooth') => {
    const container = messagesScrollRef.current
    const bubble = messageBubbleRefs.current[messageId]
    if (!container || !bubble) return

    const containerRect = container.getBoundingClientRect()
    const bubbleRect = bubble.getBoundingClientRect()
    const topPadding = 12
    const targetTop = container.scrollTop + (bubbleRect.top - containerRect.top) - topPadding

    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior,
    })
  }

  const threadId = thread?.id
  const messageCount = thread?.messages.length ?? 0
  const lastMsg = messageCount ? thread?.messages[messageCount - 1] : undefined
  const lastMessageText = lastMsg?.text
  const lastMessageRole = lastMsg?.role
  const userMessageCount = thread?.messages.reduce(
    (count, m) => count + (m.role === 'user' ? 1 : 0),
    0
  )

  useEffect(() => {
    if (!threadId) return
    if (isLoading) {
      // If we're about to anchor a follow-up question, don't also auto-scroll to bottom.
      if (lastMessageRole === 'user' && (userMessageCount ?? 0) >= 2) return
      if (isNearBottom()) scheduleScrollToBottom('auto')
      return
    }
    scheduleScrollToBottom('smooth')
  }, [messageCount, lastMessageText, lastMessageRole, userMessageCount, isLoading, threadId])

  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current
    prevIsLoadingRef.current = isLoading

    // Cursor-like behavior: when a follow-up is sent and streaming starts,
    // scroll the user's question to the top of the panel.
    if (!thread || wasLoading || !isLoading) return

    const userMessages = thread.messages.filter(m => m.role === 'user')
    if (userMessages.length < 2) return

    const lastMessage = thread.messages[thread.messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'user') return

    // Cancel any pending bottom-scroll from other effects.
    if (scrollRafRef.current != null) {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = null
    }

    requestAnimationFrame(() => {
      scrollMessageToTop(lastMessage.id, 'smooth')
    })
  }, [isLoading, thread])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (thread?.id && !editingMessageId) {
      const timeout = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timeout)
    }
  }, [thread?.id, editingMessageId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return
    onSendMessage(inputValue)
    setInputValue('')
  }

  const startEditing = (messageId: string, text: string) => {
    const bubble = messageBubbleRefs.current[messageId]
    if (bubble) {
      setEditWidthPx(bubble.getBoundingClientRect().width)
    } else {
      setEditWidthPx(null)
    }
    setEditingMessageId(messageId)
    setEditValue(text)
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditValue('')
    setEditWidthPx(null)
  }

  const saveEdit = (messageId: string) => {
    if (!editValue.trim() || !onUpdateMessage) return
    onUpdateMessage(messageId, editValue)
    setEditingMessageId(null)
    setEditValue('')
    setEditWidthPx(null)
  }

  const handleCopy = async (messageId: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedMessageId(messageId)
    setTimeout(() => setCopiedMessageId(null), 1500)
  }

  if (!thread) {
    return null
  }

  const isGeneralThread = thread.context === 'Entire Document'
  const lastMessage = thread.messages[thread.messages.length - 1]
  const showTypingIndicator =
    isLoading && (!lastMessage || lastMessage.role !== 'assistant' || !lastMessage.text)

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
              {isGeneralThread ? 'General Discussion' : `Re: ${thread.snippet}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isReadOnly && (
            <button
              onClick={onDelete}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
              title="Delete thread"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-dark-elevated rounded-full text-slate-500 dark:text-zinc-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesScrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 dark:bg-dark-base/50"
      >
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
          const isError = msg.role === 'assistant' && isErrorMessage(msg.text)
          const isLastMessage = index === thread.messages.length - 1
          const isEditing = msg.id === editingMessageId
          const parts = getMessageParts(msg.parts, msg.text)

          if (isLastMessage && isLoading && msg.role === 'assistant' && !msg.text) {
            return null
          }

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} group`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-200'
                    : isError
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                      : 'bg-cyan-100 dark:bg-accent-glow text-cyan-600 dark:text-accent'
                }`}
              >
                {msg.role === 'user' ? (
                  <User size={16} />
                ) : isError ? (
                  <AlertCircle size={16} />
                ) : (
                  <Bot size={16} />
                )}
              </div>
              <div className="flex flex-col gap-2 max-w-[85%]">
                <div
                  className={`rounded-2xl p-3 text-sm leading-relaxed shadow-sm overflow-hidden relative ${
                    msg.role === 'user'
                      ? 'bg-slate-800 dark:bg-zinc-700 text-white rounded-tr-none'
                      : isError
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-tl-none'
                        : 'bg-white dark:bg-dark-elevated border border-slate-100 dark:border-dark-border text-slate-700 dark:text-zinc-200 rounded-tl-none markdown-chat'
                  }`}
                  ref={el => {
                    messageBubbleRefs.current[msg.id] = el
                  }}
                  style={isEditing && editWidthPx ? { minWidth: `${editWidthPx}px` } : undefined}
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-full bg-white/5 dark:bg-black/10 border border-transparent rounded-lg px-2 py-1.5 text-[inherit] placeholder:text-white/60 focus:outline-none focus:ring-1 focus:ring-accent/60 resize-none leading-relaxed"
                        rows={1}
                        autoFocus
                        placeholder="Edit message..."
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={cancelEditing}
                          className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 transition-colors"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                        <button
                          onClick={() => saveEdit(msg.id)}
                          className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 transition-colors"
                          title="Save"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    </div>
                  ) : msg.role === 'user' ? (
                    msg.text
                  ) : isError ? (
                    <span>{msg.text.replace('Error: ', '')}</span>
                  ) : (
                    <MessageContent parts={parts} isStreaming={isLastMessage && isLoading} />
                  )}
                </div>

                {/* Actions Row */}
                <div className="flex items-center gap-3 self-start h-4">
                  {msg.role === 'user' && !isEditing && !isReadOnly && (
                    <button
                      onClick={() => startEditing(msg.id, msg.text)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                  )}
                  {msg.role === 'assistant' && !isError && !(isLastMessage && isLoading) && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300"
                    >
                      {copiedMessageId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedMessageId === msg.id ? 'Copied' : 'Copy'}
                    </button>
                  )}
                  {isError && isLastMessage && (
                    <div className="flex items-center gap-3">
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
            </div>
          )
        })}

        {showTypingIndicator && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-accent-glow text-cyan-600 dark:text-accent flex items-center justify-center shrink-0 animate-pulse">
              <Sparkles size={16} />
            </div>
            <div className="bg-white dark:bg-dark-elevated border border-slate-100 dark:border-dark-border p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
              <div
                className="w-2 h-2 bg-accent rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              ></div>
              <div
                className="w-2 h-2 bg-accent rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              ></div>
              <div
                className="w-2 h-2 bg-accent rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
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
            placeholder={isGeneralThread ? 'Ask about the document...' : 'Ask a follow-up...'}
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
