import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  Download,
  History,
  Loader2,
  MessageCircle,
  Moon,
  MoreHorizontal,
  PenTool,
  Settings as SettingsIcon,
  Share,
  Sun,
  Trash2,
} from "lucide-react"
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"

const MarkdownRenderer = lazy(() => import("./components/MarkdownRenderer"))

import Dialog, { DialogState } from "./components/Dialog"
import HistoryPanel from "./components/HistoryPanel"
import QuotesView from "./components/QuotesView"
import SettingsModal from "./components/SettingsModal"
import SharedBanner from "./components/SharedBanner"
import StartView from "./components/StartView"
import ThreadList from "./components/ThreadList"
import ThreadPanel from "./components/ThreadPanel"
import Tooltip from "./components/Tooltip"

import { useSession, createNewSession } from "./hooks/useSession"
import { useDarkMode } from "./hooks/useDarkMode"
import { useSettings } from "./hooks/useSettings"
import { useQuotes } from "./hooks/useQuotes"
import { useThreadManager } from "./hooks/useThreadManager"
import { useTextSelection } from "./hooks/useTextSelection"
import { useAiStreaming } from "./hooks/useAiStreaming"
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts"

import {
  getHistory,
  addToHistory,
  removeFromHistory,
  updateHistoryEntry,
  getCurrentSessionId,
  setCurrentSessionId,
  extractTitle,
} from "./services/sessionHistory"
import { generateSessionSummary, streamThreadResponse } from "./services/aiService"
import { Thread, ViewState, SourceMetadata, SessionMeta } from "./types"

function getSessionIdFromUrl(): string | null {
  const path = window.location.pathname
  const match = path.match(/^\/([a-zA-Z0-9_-]{10,})$/)
  return match ? match[1] : null
}

const App: React.FC = () => {
  // URL is the single source of truth for session identity
  const [sessionId, setSessionId] = useState<string | null>(() => getSessionIdFromUrl())
  const session = useSession(sessionId, {
    onSessionChange: setSessionId,
  })
  const [showSharedBanner, setShowSharedBanner] = useState(true)

  // View state
  const [viewState, setViewState] = useState<ViewState>(ViewState.START)
  const [markdownContent, setMarkdownContent] = useState("")
  const [sourceMetadata, setSourceMetadata] = useState<SourceMetadata | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [generalInputValue, setGeneralInputValue] = useState("")
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: "alert",
    title: "",
    message: "",
  })
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Session history from localStorage (just metadata for display)
  const [sessionHistory, setSessionHistory] = useState<SessionMeta[]>([])

  // Extracted hooks
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const { settings, isSettingsOpen, openSettings, closeSettings, saveSettings } = useSettings()
  const { quotes, addQuote, deleteQuote, setQuotes } = useQuotes()
  const threadManager = useThreadManager()
  const { selection, clearSelection } = useTextSelection(
    contentRef,
    viewState === ViewState.READING
  )
  const { isLoading: isAiLoading, streamResponse } = useAiStreaming(
    settings,
    threadManager,
    session
  )

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onEscape: () => {
      if (selection) {
        clearSelection()
      } else if (isSidebarOpen) {
        setIsSidebarOpen(false)
      }
    },
    onOpenSettings: openSettings,
  })

  // Load session history from localStorage on mount
  useEffect(() => {
    setSessionHistory(getHistory())
  }, [])

  // Load session from API when sessionId changes
  useEffect(() => {
    if (sessionId && session.session && !session.isLoading) {
      const apiThreads: Thread[] = session.session.threads.map(t => ({
        id: t.id,
        context: t.context,
        snippet: t.snippet,
        createdAt: t.createdAt,
        messages: t.messages.map(m => ({
          role: m.role,
          text: m.text,
          timestamp: m.timestamp,
        })),
      }))

      setMarkdownContent(session.session.markdownContent)
      threadManager.setThreads(apiThreads)
      setViewState(ViewState.READING)

      // Add to history when session loads
      if (sessionId) {
        const entry: SessionMeta = {
          id: sessionId,
          title: extractTitle(session.session.markdownContent),
          summary: null,
          lastModified: Date.now(),
        }
        addToHistory(entry)
        setSessionHistory(getHistory())
        setCurrentSessionId(sessionId)

        // Generate summary in background if needed
        const existing = getHistory().find(h => h.id === sessionId)
        if (!existing?.summary && (settings.apiKey || settings.provider === "ollama")) {
          generateSessionSummary(session.session.markdownContent, settings).then(summary => {
            if (summary) {
              updateHistoryEntry(sessionId, { summary })
              setSessionHistory(getHistory())
            }
          })
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.session, session.isLoading, sessionId])

  // Handle popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const newSessionId = getSessionIdFromUrl()
      setSessionId(newSessionId)
      if (!newSessionId) {
        setViewState(ViewState.START)
        setMarkdownContent("")
        threadManager.setThreads([])
        setQuotes([])
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On mount, check if we should restore last session
  useEffect(() => {
    if (sessionId) return // Already have a session from URL

    const lastSessionId = getCurrentSessionId()
    if (lastSessionId) {
      // Navigate to last session
      window.history.replaceState(null, "", `/${lastSessionId}`)
      setSessionId(lastSessionId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false)
      }
    }
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showMoreMenu])

  // Event handlers
  const handleDocumentMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest("button") && !target.closest("input")) {
      clearSelection()
    }
  }

  const handleExport = () => {
    let exportText = markdownContent

    if (quotes.length > 0) {
      exportText += "\n\n---\n\n# Saved Quotes\n\n"
      quotes.forEach(q => {
        exportText += `> "${q.text}"\n\n`
      })
    }

    if (threadManager.threads.length > 0) {
      exportText += "\n\n---\n\n# Discussions\n\n"
      threadManager.threads.forEach(t => {
        exportText += `## Thread: ${t.snippet}\n`
        exportText += `> **Context**: ${t.context}\n\n`
        t.messages.forEach(m => {
          exportText += `**${m.role === "user" ? "User" : "AI"}**: ${m.text}\n\n`
        })
        exportText += "---\n\n"
      })
    }

    const blob = new Blob([exportText], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `threaded-export-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // New session: navigate to / and clear state
  const handleNewSession = useCallback(() => {
    window.history.pushState(null, "", "/")
    setSessionId(null)
    setCurrentSessionId(null)
    setMarkdownContent("")
    threadManager.setThreads([])
    setQuotes([])
    setSourceMetadata(null)
    setViewState(ViewState.START)
  }, [threadManager, setQuotes])

  // Content ready: create via API, then navigate
  const handleContentReady = useCallback(async (content: string, source?: SourceMetadata) => {
    setIsCreatingSession(true)
    try {
      const result = await createNewSession(content)
      if (result) {
        window.history.pushState(null, "", `/${result.sessionId}`)
        setSessionId(result.sessionId)
        setSourceMetadata(source || null)
        // useSession will load the session and add to history
      }
    } finally {
      setIsCreatingSession(false)
    }
  }, [])

  // Select from history: navigate to session URL
  const handleSelectSession = useCallback((id: string) => {
    window.history.pushState(null, "", `/${id}`)
    setSessionId(id)
    // useSession handles loading, which triggers the effect that sets view state
  }, [])

  // Delete session from history
  const handleDeleteFromHistory = useCallback(
    async (id: string) => {
      // If it's the current session, also delete from API
      if (id === sessionId && session.isOwner) {
        await session.deleteSession()
      }

      removeFromHistory(id)
      setSessionHistory(getHistory())

      // If we deleted the current session, go to start
      if (id === sessionId) {
        handleNewSession()
      }
    },
    [sessionId, session, handleNewSession]
  )

  // Share: copy link or create session first
  const handleShare = async () => {
    let shareSessionId = sessionId

    if (!shareSessionId) {
      if (!markdownContent.trim()) {
        setDialog({
          isOpen: true,
          type: "error",
          title: "Cannot Share",
          message: "No content to share. Please add some content first.",
        })
        return
      }

      setIsCreatingSession(true)
      try {
        const result = await createNewSession(markdownContent)
        if (!result) {
          setDialog({
            isOpen: true,
            type: "error",
            title: "Share Failed",
            message: "Failed to create shareable link. Please try again.",
          })
          return
        }

        shareSessionId = result.sessionId
        setSessionId(shareSessionId)
        window.history.pushState(null, "", `/${shareSessionId}`)
      } finally {
        setIsCreatingSession(false)
      }
    }

    const shareUrl = `${window.location.origin}/${shareSessionId}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setDialog({
        isOpen: true,
        type: "success",
        title: "Link Copied",
        message: `Share URL copied to clipboard: ${shareUrl}`,
      })
    } catch {
      prompt("Copy this link:", shareUrl)
    }
  }

  // Delete current session (owner only)
  const executeDeleteSession = useCallback(async () => {
    if (!sessionId || !session.isOwner) return

    const success = await session.deleteSession()
    if (success) {
      removeFromHistory(sessionId)
      setSessionHistory(getHistory())
      handleNewSession()
    }
  }, [sessionId, session, handleNewSession])

  const handleDeleteSession = () => {
    if (!sessionId || !session.isOwner) return

    setDialog({
      isOpen: true,
      type: "confirm",
      title: "Delete Session",
      message: "Are you sure you want to delete this session? This cannot be undone.",
      onConfirm: executeDeleteSession,
    })
  }

  const createThread = async (action: "discuss" | "summarize") => {
    if (!selection) return

    const newThreadId = Date.now().toString()
    const snippet =
      selection.text.length > 30 ? selection.text.substring(0, 30) + "..." : selection.text

    const newThread: Thread = {
      id: newThreadId,
      context: selection.text,
      messages: [],
      createdAt: Date.now(),
      snippet,
    }

    threadManager.addThread(newThread)
    threadManager.setActiveThreadId(newThreadId)
    setIsSidebarOpen(true)
    clearSelection()

    // Save to API
    let apiThreadId = newThreadId
    if (sessionId) {
      const savedThreadId = await session.addThread(selection.text, snippet)
      if (savedThreadId && savedThreadId !== newThreadId) {
        threadManager.updateThreadId(newThreadId, savedThreadId)
        apiThreadId = savedThreadId
      }
    }

    if (action === "discuss") {
      return
    }

    // For "summarize", add user message and stream AI response
    const initialUserMessage = "Please explain this section in simple terms."
    threadManager.addMessageToThread(apiThreadId, {
      role: "user",
      text: initialUserMessage,
      timestamp: Date.now(),
    })

    if (sessionId) {
      await session.addMessage(apiThreadId, "user", initialUserMessage)
    }

    await streamResponse({
      threadId: apiThreadId,
      context: selection.text,
      markdownContent,
      messages: [{ role: "user", text: initialUserMessage, timestamp: Date.now() }],
      userMessage: initialUserMessage,
      mode: "explain",
    })
  }

  const handleCreateGeneralThread = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!generalInputValue.trim()) return

    const initialMessage = generalInputValue
    setGeneralInputValue("")

    const newThreadId = Date.now().toString()
    const newThread: Thread = {
      id: newThreadId,
      context: "Entire Document",
      messages: [{ role: "user", text: initialMessage, timestamp: Date.now() }],
      createdAt: Date.now(),
      snippet: "General Discussion",
    }

    threadManager.addThread(newThread)
    threadManager.setActiveThreadId(newThreadId)
    setIsSidebarOpen(true)

    let apiThreadId = newThreadId
    if (sessionId) {
      const savedThreadId = await session.addThread("Entire Document", "General Discussion")
      if (savedThreadId && savedThreadId !== newThreadId) {
        threadManager.updateThreadId(newThreadId, savedThreadId)
        apiThreadId = savedThreadId
      }
    }

    if (sessionId) {
      await session.addMessage(apiThreadId, "user", initialMessage)
    }

    await streamResponse({
      threadId: apiThreadId,
      context: "Entire Document",
      markdownContent,
      messages: [{ role: "user", text: initialMessage, timestamp: Date.now() }],
      userMessage: initialMessage,
      mode: "discuss",
    })
  }

  const handleSendMessage = async (text: string) => {
    if (!threadManager.activeThreadId || !threadManager.activeThread) return

    const userMessage = { role: "user" as const, text, timestamp: Date.now() }
    threadManager.addMessageToThread(threadManager.activeThreadId, userMessage)

    if (sessionId) {
      await session.addMessage(threadManager.activeThreadId, "user", text)
    }

    await streamResponse({
      threadId: threadManager.activeThreadId,
      context: threadManager.activeThread.context,
      markdownContent,
      messages: [...threadManager.activeThread.messages, userMessage],
      userMessage: text,
      mode: "discuss",
    })
  }

  const handleViewThreadList = () => {
    threadManager.setActiveThreadId(null)
    setIsSidebarOpen(true)
  }

  const handleSaveQuote = () => {
    if (!selection) return
    addQuote(selection.text)
    clearSelection()
  }

  const handleRetry = async () => {
    if (!threadManager.activeThreadId || !threadManager.activeThread) return

    const currentThread = threadManager.activeThread
    if (currentThread.messages.length < 2) return

    const messages = currentThread.messages
    const lastUserMessageIndex =
      messages.length >= 2 && messages[messages.length - 1].role === "model"
        ? messages.length - 2
        : -1

    if (lastUserMessageIndex < 0 || messages[lastUserMessageIndex].role !== "user") return

    const lastUserMessage = messages[lastUserMessageIndex].text

    threadManager.replaceLastMessage(threadManager.activeThreadId, {
      role: "model",
      text: "",
      timestamp: Date.now(),
    })

    let fullResponse = ""
    try {
      for await (const chunk of streamThreadResponse(
        currentThread.context,
        markdownContent,
        messages.slice(0, lastUserMessageIndex + 1),
        lastUserMessage,
        settings,
        "discuss"
      )) {
        fullResponse += chunk
        threadManager.appendToLastMessage(threadManager.activeThreadId!, chunk)
      }

      if (sessionId && fullResponse) {
        await session.addMessage(threadManager.activeThreadId!, "model", fullResponse)
      }
    } catch (error) {
      const aiError = error as { message?: string }
      threadManager.updateLastMessage(
        threadManager.activeThreadId!,
        `Error: ${aiError.message || "An error occurred"}`
      )
    }
  }

  // --- Render ---

  if (viewState === ViewState.QUOTES) {
    return (
      <QuotesView
        quotes={quotes}
        onBack={() => setViewState(ViewState.READING)}
        onDeleteQuote={deleteQuote}
      />
    )
  }

  if (viewState === ViewState.START) {
    return (
      <>
        <HistoryPanel
          sessions={sessionHistory}
          currentSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteFromHistory}
          onNewSession={handleNewSession}
          isOpen={isHistoryOpen}
          onToggle={() => setIsHistoryOpen(prev => !prev)}
        />
        <StartView
          onContentReady={handleContentReady}
          settings={settings}
          onSaveSettings={saveSettings}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onToggleHistory={() => setIsHistoryOpen(prev => !prev)}
        />
      </>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-dark-base transition-colors duration-300">
      {/* History Panel */}
      <HistoryPanel
        sessions={sessionHistory}
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteFromHistory}
        onNewSession={handleNewSession}
        isOpen={isHistoryOpen}
        onToggle={() => setIsHistoryOpen(prev => !prev)}
      />

      {/* Shared Session Banner */}
      {sessionId && !session.isOwner && showSharedBanner && (
        <SharedBanner onDismiss={() => setShowSharedBanner(false)} />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Document View Container */}
        <div
          className={`flex-1 h-full relative flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-1/2" : "w-full"}`}
          onMouseDown={handleDocumentMouseDown}
        >
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto w-full">
            <div className="max-w-[720px] mx-auto px-8 py-16">
              <header className="mb-8 flex items-center justify-between sticky top-0 z-10 py-3 bg-white/90 dark:bg-dark-base/90 backdrop-blur-sm -mx-4 px-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsHistoryOpen(prev => !prev)}
                    className="p-1.5 rounded-md text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-dark-elevated transition-colors"
                    title="History"
                  >
                    <History size={18} />
                  </button>
                  <span className="text-slate-200 dark:text-zinc-700">|</span>
                  <button
                    onClick={handleNewSession}
                    className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                  >
                    <PenTool size={15} />
                    <span>New</span>
                  </button>
                  {sourceMetadata && (
                    <>
                      <span className="text-slate-300 dark:text-zinc-600">·</span>
                      <span className="text-sm text-slate-400 dark:text-zinc-500 truncate max-w-[180px]">
                        {sourceMetadata.type === "paste"
                          ? "Pasted"
                          : sourceMetadata.type === "url"
                            ? (() => {
                                try {
                                  return new URL(sourceMetadata.name!).hostname
                                } catch {
                                  return sourceMetadata.name
                                }
                              })()
                            : sourceMetadata.name}
                      </span>
                    </>
                  )}
                  {threadManager.threads.length > 0 && (
                    <button
                      onClick={handleViewThreadList}
                      className="text-sm text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 px-2.5 py-1 rounded-full font-medium transition-colors hover:bg-slate-100 dark:hover:bg-dark-elevated"
                    >
                      {threadManager.threads.length} thread
                      {threadManager.threads.length !== 1 && "s"}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {quotes.length > 0 && (
                    <button
                      onClick={() => setViewState(ViewState.QUOTES)}
                      className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-dark-elevated text-amber-500 dark:text-amber-400 transition-colors"
                      title={`${quotes.length} saved quote${quotes.length !== 1 ? "s" : ""}`}
                    >
                      <Bookmark size={18} />
                    </button>
                  )}
                  <button
                    onClick={handleShare}
                    disabled={isCreatingSession}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-dark-elevated text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
                    title="Share"
                  >
                    {isCreatingSession ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Share size={18} />
                    )}
                  </button>
                  <button
                    onClick={toggleDarkMode}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-dark-elevated text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                    title={isDarkMode ? "Light mode" : "Dark mode"}
                  >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-dark-elevated text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                      title="More options"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {showMoreMenu && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-dark-surface rounded-lg shadow-lg border border-slate-200 dark:border-dark-border py-1 z-50">
                        <button
                          onClick={() => {
                            handleExport()
                            setShowMoreMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-dark-elevated flex items-center gap-3"
                        >
                          <Download size={16} />
                          Export
                        </button>
                        {quotes.length === 0 && (
                          <button
                            onClick={() => {
                              setViewState(ViewState.QUOTES)
                              setShowMoreMenu(false)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-dark-elevated flex items-center gap-3"
                          >
                            <Bookmark size={16} />
                            Saved quotes
                          </button>
                        )}
                        <button
                          onClick={() => {
                            openSettings()
                            setShowMoreMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-dark-elevated flex items-center gap-3"
                        >
                          <SettingsIcon size={16} />
                          Settings
                        </button>
                        {sessionId && session.isOwner && (
                          <>
                            <div className="my-1 border-t border-slate-200 dark:border-dark-border" />
                            <button
                              onClick={() => {
                                handleDeleteSession()
                                setShowMoreMenu(false)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </header>
              {/* API Key Warning Banner */}
              {!settings.apiKey && settings.provider !== "ollama" && (
                <button
                  onClick={openSettings}
                  className="w-full mb-8 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group"
                >
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="flex-1 text-left">
                    No API key configured for{" "}
                    {settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1)}. Click
                    to open Settings.
                  </span>
                  <SettingsIcon
                    size={16}
                    className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                  />
                </button>
              )}
              <div ref={contentRef}>
                <Suspense
                  fallback={<div className="animate-pulse text-slate-400">Loading content...</div>}
                >
                  <MarkdownRenderer
                    content={markdownContent}
                    className="font-serif text-slate-800 dark:text-zinc-100"
                  />
                </Suspense>
              </div>
              <div className="h-32"></div>
            </div>
          </div>

          {/* Floating General Chat Input */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center px-4 pointer-events-none z-10">
            <div
              className={`transition-all duration-300 ${isSidebarOpen ? "max-w-sm" : "max-w-xl"} w-full pointer-events-auto`}
            >
              <form onSubmit={handleCreateGeneralThread} className="relative group">
                <div className="absolute inset-0 bg-slate-900/5 dark:bg-zinc-100/5 rounded-full blur-md transform translate-y-2 group-hover:translate-y-1 transition-transform"></div>
                <div className="relative bg-white dark:bg-dark-surface rounded-full shadow-xl border border-slate-200 dark:border-dark-border flex items-center p-1.5 transition-all focus-within:border-accent dark:focus-within:border-accent focus-within:shadow-blue-100 dark:focus-within:shadow-none">
                  <div className="pl-4 pr-2 text-slate-400 dark:text-zinc-500">
                    <MessageCircle size={20} />
                  </div>
                  <input
                    type="text"
                    value={generalInputValue}
                    onChange={e => setGeneralInputValue(e.target.value)}
                    placeholder="Ask a question about the whole document..."
                    className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 py-2.5"
                  />
                  <button
                    type="submit"
                    disabled={!generalInputValue.trim()}
                    className="p-2 bg-slate-900 dark:bg-zinc-700 text-white rounded-full hover:bg-slate-800 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </div>
          </div>

          {selection && selection.rect && (
            <Tooltip
              rect={selection.rect}
              text={selection.text}
              onAction={createThread}
              onSaveQuote={handleSaveQuote}
            />
          )}
        </div>

        {/* Right Pane: Thread Sidebar */}
        <div
          className={`fixed inset-y-0 right-0 w-[450px] transform transition-transform duration-300 ease-in-out shadow-2xl z-40 bg-white dark:bg-dark-surface border-l border-slate-200 dark:border-dark-border ${isSidebarOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          {threadManager.activeThreadId ? (
            <ThreadPanel
              thread={threadManager.activeThread}
              isLoading={isAiLoading}
              onClose={() => setIsSidebarOpen(false)}
              onBack={() => threadManager.setActiveThreadId(null)}
              onSendMessage={handleSendMessage}
              onDelete={() => threadManager.deleteThread(threadManager.activeThreadId!)}
              onRetry={handleRetry}
              onOpenSettings={openSettings}
            />
          ) : (
            <ThreadList
              threads={threadManager.threads}
              onSelectThread={threadManager.setActiveThreadId}
              onClose={() => setIsSidebarOpen(false)}
            />
          )}
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        currentSettings={settings}
        onSave={saveSettings}
      />

      <Dialog state={dialog} onClose={() => setDialog(prev => ({ ...prev, isOpen: false }))} />
    </div>
  )
}

export default App
