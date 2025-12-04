import {
  AlertCircle,
  ArrowRight,
  Download,
  LayoutTemplate,
  MessageCircle,
  Moon,
  PenTool,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react"
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"

const MarkdownRenderer = lazy(() => import("./components/MarkdownRenderer"))

import SettingsModal from "./components/SettingsModal"
import ThreadList from "./components/ThreadList"
import ThreadPanel from "./components/ThreadPanel"
import Tooltip from "./components/Tooltip"
import { AIError, streamThreadResponse } from "./services/aiService"
import { loadSession, saveSession } from "./services/storage"
import { AppSettings, TextSelection, Thread, ViewState } from "./types"

const DEFAULT_TEXT = ``

const DEFAULT_SETTINGS: AppSettings = {
  provider: "google",
  apiKey: "",
  modelId: "gemini-3-pro",
}

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>(ViewState.START)
  const [markdownContent, setMarkdownContent] = useState(DEFAULT_TEXT)
  const [selection, setSelection] = useState<TextSelection | null>(null)
  const [threads, setThreads] = useState<Thread[]>([])

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem("threaded-dark-mode")
    if (stored !== null) {
      return stored === "true"
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const [isAiLoading, setIsAiLoading] = useState(false)
  const [generalInputValue, setGeneralInputValue] = useState("")

  const contentRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isSessionLoaded, setIsSessionLoaded] = useState(false)

  useEffect(() => {
    const storedSettings = localStorage.getItem("threaded-settings")
    if (storedSettings) {
      try {
        setSettings(JSON.parse(storedSettings))
      } catch (e) {
        console.error("Failed to parse settings", e)
      }
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      const session = await loadSession()
      if (session) {
        setMarkdownContent(session.document)
        setThreads(session.threads)
        if (session.threads.length > 0) {
          setViewState(ViewState.READING)
        }
      }
      setIsSessionLoaded(true)
    }
    load()
  }, [])

  const debouncedSave = useCallback((document: string, threads: Thread[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveSession(document, threads)
    }, 500)
  }, [])

  useEffect(() => {
    if (isSessionLoaded) {
      debouncedSave(markdownContent, threads)
    }
  }, [markdownContent, threads, isSessionLoaded, debouncedSave])

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings)
    localStorage.setItem("threaded-settings", JSON.stringify(newSettings))
  }

  useEffect(() => {
    localStorage.setItem("threaded-dark-mode", String(isDarkMode))
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selection) {
          setSelection(null)
          window.getSelection()?.removeAllRanges()
        } else if (isSidebarOpen) {
          setIsSidebarOpen(false)
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsSettingsOpen(true)
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selection, isSidebarOpen])

  useEffect(() => {
    const handleSelectionChange = () => {
      if (viewState !== ViewState.READING) return

      const currentSelection = window.getSelection()

      if (
        !currentSelection ||
        currentSelection.isCollapsed ||
        !contentRef.current?.contains(currentSelection.anchorNode)
      ) {
        return
      }

      const text = currentSelection.toString().trim()
      if (text.length > 0) {
        const range = currentSelection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setSelection({ text, rect })
      }
    }

    document.addEventListener("mouseup", handleSelectionChange)
    document.addEventListener("keyup", handleSelectionChange)

    return () => {
      document.removeEventListener("mouseup", handleSelectionChange)
      document.removeEventListener("keyup", handleSelectionChange)
    }
  }, [viewState])

  const handleStart = () => {
    if (markdownContent.trim()) {
      setViewState(ViewState.READING)
    }
  }

  const handleDocumentMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest("button") && !target.closest("input")) {
      setSelection(null)
      window.getSelection()?.removeAllRanges()
    }
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  const handleExport = () => {
    let exportText = markdownContent + "\n\n# Discussions (Exported)\n\n"
    threads.forEach(t => {
      exportText += `## Thread: ${t.snippet}\n`
      exportText += `> **Context**: ${t.context}\n\n`
      t.messages.forEach(m => {
        exportText += `**${m.role === "user" ? "User" : "AI"}**: ${m.text}\n\n`
      })
      exportText += "---\n\n"
    })

    const blob = new Blob([exportText], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `threaded-export-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const createThread = async (action: "discuss" | "summarize") => {
    if (!selection) return

    const newThreadId = Date.now().toString()
    const snippet =
      selection.text.length > 30 ? selection.text.substring(0, 30) + "..." : selection.text

    if (action === "discuss") {
      const newThread: Thread = {
        id: newThreadId,
        context: selection.text,
        messages: [],
        createdAt: Date.now(),
        snippet,
      }

      setThreads(prev => [...prev, newThread])
      setActiveThreadId(newThreadId)
      setIsSidebarOpen(true)
      setSelection(null)
      window.getSelection()?.removeAllRanges()
      return
    }

    const initialUserMessage = "Please explain this section in simple terms."
    const newThread: Thread = {
      id: newThreadId,
      context: selection.text,
      messages: [{ role: "user", text: initialUserMessage, timestamp: Date.now() }],
      createdAt: Date.now(),
      snippet,
    }

    setThreads(prev => [...prev, newThread])
    setActiveThreadId(newThreadId)
    setIsSidebarOpen(true)
    setSelection(null)
    window.getSelection()?.removeAllRanges()

    const aiMessageTimestamp = Date.now()
    setThreads(prev =>
      prev.map(t => {
        if (t.id === newThreadId) {
          return {
            ...t,
            messages: [...t.messages, { role: "model", text: "", timestamp: aiMessageTimestamp }],
          }
        }
        return t
      })
    )

    setIsAiLoading(true)
    try {
      for await (const chunk of streamThreadResponse(
        newThread.context,
        markdownContent,
        newThread.messages,
        initialUserMessage,
        settings,
        "explain"
      )) {
        setThreads(prev =>
          prev.map(t => {
            if (t.id === newThreadId) {
              const messages = [...t.messages]
              const lastMessage = messages[messages.length - 1]
              if (lastMessage && lastMessage.role === "model") {
                messages[messages.length - 1] = {
                  ...lastMessage,
                  text: lastMessage.text + chunk,
                }
              }
              return { ...t, messages }
            }
            return t
          })
        )
      }
    } catch (error) {
      const aiError = error as AIError
      setThreads(prev =>
        prev.map(t => {
          if (t.id === newThreadId) {
            const messages = [...t.messages]
            const lastMessage = messages[messages.length - 1]
            if (lastMessage && lastMessage.role === "model") {
              messages[messages.length - 1] = {
                ...lastMessage,
                text: `Error: ${aiError.message}`,
              }
            }
            return { ...t, messages }
          }
          return t
        })
      )
    }
    setIsAiLoading(false)
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

    setThreads(prev => [...prev, newThread])
    setActiveThreadId(newThreadId)
    setIsSidebarOpen(true)

    setThreads(prev =>
      prev.map(t =>
        t.id === newThreadId
          ? { ...t, messages: [...t.messages, { role: "model", text: "", timestamp: Date.now() }] }
          : t
      )
    )

    setIsAiLoading(true)
    try {
      for await (const chunk of streamThreadResponse(
        newThread.context,
        markdownContent,
        newThread.messages,
        initialMessage,
        settings,
        "discuss"
      )) {
        setThreads(prev =>
          prev.map(t => {
            if (t.id === newThreadId) {
              const messages = [...t.messages]
              const lastMessage = messages[messages.length - 1]
              if (lastMessage && lastMessage.role === "model") {
                messages[messages.length - 1] = {
                  ...lastMessage,
                  text: lastMessage.text + chunk,
                }
              }
              return { ...t, messages }
            }
            return t
          })
        )
      }
    } catch (error) {
      const aiError = error as AIError
      setThreads(prev =>
        prev.map(t => {
          if (t.id === newThreadId) {
            const messages = [...t.messages]
            const lastMessage = messages[messages.length - 1]
            if (lastMessage && lastMessage.role === "model") {
              messages[messages.length - 1] = {
                ...lastMessage,
                text: `Error: ${aiError.message}`,
              }
            }
            return { ...t, messages }
          }
          return t
        })
      )
    }
    setIsAiLoading(false)
  }

  const handleSendMessage = async (text: string) => {
    if (!activeThreadId) return

    const currentThread = threads.find(t => t.id === activeThreadId)
    if (!currentThread) return

    const userMessage = { role: "user" as const, text, timestamp: Date.now() }
    const messagesWithUser = [...currentThread.messages, userMessage]

    // Add user message
    setThreads(prev =>
      prev.map(t => {
        if (t.id === activeThreadId) {
          return { ...t, messages: messagesWithUser }
        }
        return t
      })
    )

    setThreads(prev =>
      prev.map(t =>
        t.id === activeThreadId
          ? { ...t, messages: [...t.messages, { role: "model", text: "", timestamp: Date.now() }] }
          : t
      )
    )

    setIsAiLoading(true)
    try {
      for await (const chunk of streamThreadResponse(
        currentThread.context,
        markdownContent,
        messagesWithUser,
        text,
        settings,
        "discuss"
      )) {
        setThreads(prev =>
          prev.map(t => {
            if (t.id === activeThreadId) {
              const messages = [...t.messages]
              const lastMessage = messages[messages.length - 1]
              if (lastMessage && lastMessage.role === "model") {
                messages[messages.length - 1] = {
                  ...lastMessage,
                  text: lastMessage.text + chunk,
                }
              }
              return { ...t, messages }
            }
            return t
          })
        )
      }
    } catch (error) {
      const aiError = error as AIError
      setThreads(prev =>
        prev.map(t => {
          if (t.id === activeThreadId) {
            const messages = [...t.messages]
            const lastMessage = messages[messages.length - 1]
            if (lastMessage && lastMessage.role === "model") {
              messages[messages.length - 1] = {
                ...lastMessage,
                text: `Error: ${aiError.message}`,
              }
            }
            return { ...t, messages }
          }
          return t
        })
      )
    }
    setIsAiLoading(false)
  }

  const handleViewThreadList = () => {
    setActiveThreadId(null)
    setIsSidebarOpen(true)
  }

  const handleDeleteThread = (threadId: string) => {
    setThreads(prev => prev.filter(t => t.id !== threadId))
    if (activeThreadId === threadId) {
      setActiveThreadId(null)
    }
  }

  const handleRetry = async () => {
    if (!activeThreadId) return

    const currentThread = threads.find(t => t.id === activeThreadId)
    if (!currentThread || currentThread.messages.length < 2) return

    const messages = currentThread.messages
    const lastUserMessageIndex =
      messages.length >= 2 && messages[messages.length - 1].role === "model"
        ? messages.length - 2
        : -1

    if (lastUserMessageIndex < 0 || messages[lastUserMessageIndex].role !== "user") return

    const lastUserMessage = messages[lastUserMessageIndex].text

    setThreads(prev =>
      prev.map(t => {
        if (t.id === activeThreadId) {
          return {
            ...t,
            messages: messages
              .slice(0, -1)
              .concat([{ role: "model", text: "", timestamp: Date.now() }]),
          }
        }
        return t
      })
    )

    setIsAiLoading(true)
    try {
      for await (const chunk of streamThreadResponse(
        currentThread.context,
        markdownContent,
        messages.slice(0, lastUserMessageIndex + 1),
        lastUserMessage,
        settings,
        "discuss"
      )) {
        setThreads(prev =>
          prev.map(t => {
            if (t.id === activeThreadId) {
              const msgs = [...t.messages]
              const lastMessage = msgs[msgs.length - 1]
              if (lastMessage && lastMessage.role === "model") {
                msgs[msgs.length - 1] = {
                  ...lastMessage,
                  text: lastMessage.text + chunk,
                }
              }
              return { ...t, messages: msgs }
            }
            return t
          })
        )
      }
    } catch (error) {
      const aiError = error as AIError
      setThreads(prev =>
        prev.map(t => {
          if (t.id === activeThreadId) {
            const msgs = [...t.messages]
            const lastMessage = msgs[msgs.length - 1]
            if (lastMessage && lastMessage.role === "model") {
              msgs[msgs.length - 1] = {
                ...lastMessage,
                text: `Error: ${aiError.message}`,
              }
            }
            return { ...t, messages: msgs }
          }
          return t
        })
      )
    }
    setIsAiLoading(false)
  }

  // --- Render ---

  if (viewState === ViewState.START) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <SettingsIcon size={20} />
          </button>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-600 p-3 rounded-xl text-white">
              <LayoutTemplate size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-serif">
                Threaded Reader
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                Contextual AI analysis for your documents.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Paste your Markdown content here
            </label>
            <textarea
              className="w-full h-64 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm resize-none"
              value={markdownContent}
              onChange={e => setMarkdownContent(e.target.value)}
              placeholder="# Enter your markdown here..."
            />
          </div>

          <button
            onClick={handleStart}
            disabled={!markdownContent.trim()}
            className="w-full py-4 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Start Reading</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <p className="mt-6 text-slate-400 dark:text-slate-600 text-sm">
          Powered by {settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1)}
        </p>

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentSettings={settings}
          onSave={handleSaveSettings}
        />
      </div>
    )
  }

  const activeThread = threads.find(t => t.id === activeThreadId) || null

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      {/* Left Pane: Document View Container */}
      <div
        className={`flex-1 h-full relative flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-1/2" : "w-full"}`}
        onMouseDown={handleDocumentMouseDown}
      >
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-[720px] mx-auto px-8 py-16">
            <header className="mb-12 flex items-center justify-between sticky top-0 z-10 py-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm -mx-4 px-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
                  onClick={() => setViewState(ViewState.START)}
                >
                  <PenTool size={16} />
                  <span className="text-sm font-medium">Edit Source</span>
                </div>
                <div
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
                  onClick={handleExport}
                >
                  <Download size={16} />
                  <span className="text-sm font-medium">Export</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors"
                  title="Settings"
                >
                  <SettingsIcon size={18} />
                </button>
                <button
                  onClick={toggleDarkMode}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors"
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {threads.length > 0 && (
                  <button
                    onClick={handleViewThreadList}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full font-medium transition-colors"
                  >
                    {threads.length} active threads
                  </button>
                )}
              </div>
            </header>
            {/* API Key Warning Banner */}
            {!settings.apiKey && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-full mb-8 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group"
              >
                <AlertCircle size={18} className="shrink-0" />
                <span className="flex-1 text-left">
                  No API key configured for{" "}
                  {settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1)}. Click to
                  open Settings.
                </span>
                <SettingsIcon
                  size={16}
                  className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                />
              </button>
            )}
            <div
              ref={contentRef}
              className="markdown-content font-serif text-slate-800 dark:text-slate-200"
            >
              <Suspense
                fallback={<div className="animate-pulse text-slate-400">Loading content...</div>}
              >
                <MarkdownRenderer content={markdownContent} />
              </Suspense>
            </div>
            <div className="h-32"></div> {/* Bottom padding for floating bar */}
          </div>
        </div>

        {/* Floating General Chat Input */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center px-4 pointer-events-none z-10">
          <div
            className={`transition-all duration-300 ${isSidebarOpen ? "max-w-sm" : "max-w-xl"} w-full pointer-events-auto`}
          >
            <form onSubmit={handleCreateGeneralThread} className="relative group">
              <div className="absolute inset-0 bg-slate-900/5 dark:bg-slate-100/5 rounded-full blur-md transform translate-y-2 group-hover:translate-y-1 transition-transform"></div>
              <div className="relative bg-white dark:bg-slate-900 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 flex items-center p-1.5 transition-all focus-within:border-blue-500 focus-within:shadow-blue-100 dark:focus-within:shadow-none">
                <div className="pl-4 pr-2 text-slate-400">
                  <MessageCircle size={20} />
                </div>
                <input
                  type="text"
                  value={generalInputValue}
                  onChange={e => setGeneralInputValue(e.target.value)}
                  placeholder="Ask a question about the whole document..."
                  className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 py-2.5"
                />
                <button
                  type="submit"
                  disabled={!generalInputValue.trim()}
                  className="p-2 bg-slate-900 dark:bg-slate-700 text-white rounded-full hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>

        {selection && selection.rect && (
          <Tooltip rect={selection.rect} text={selection.text} onAction={createThread} />
        )}
      </div>

      {/* Right Pane: Thread Sidebar */}
      <div
        className={`fixed inset-y-0 right-0 w-[450px] transform transition-transform duration-300 ease-in-out shadow-2xl z-40 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 ${isSidebarOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {activeThreadId ? (
          <ThreadPanel
            thread={activeThread}
            isLoading={isAiLoading}
            onClose={() => setIsSidebarOpen(false)}
            onBack={() => setActiveThreadId(null)}
            onSendMessage={handleSendMessage}
            onDelete={() => handleDeleteThread(activeThreadId)}
            onRetry={handleRetry}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : (
          <ThreadList
            threads={threads}
            onSelectThread={setActiveThreadId}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  )
}

export default App
