import React from "react"
import { X, MessageSquare, Clock, ArrowRight, FileText } from "lucide-react"
import { Thread } from "../types"

interface ThreadListProps {
  threads: Thread[]
  onSelectThread: (threadId: string) => void
  onClose: () => void
}

const ThreadList: React.FC<ThreadListProps> = ({ threads, onSelectThread, onClose }) => {
  // Sort threads by most recent activity (using last message timestamp or creation time)
  const sortedThreads = [...threads].sort((a, b) => {
    const lastA = a.messages.length > 0 ? a.messages[a.messages.length - 1].timestamp : a.createdAt
    const lastB = b.messages.length > 0 ? b.messages[b.messages.length - 1].timestamp : b.createdAt
    return lastB - lastA
  })

  const getTimeString = (timestamp: number) => {
    const diff = Date.now() - timestamp
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return "Older"
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Discussions</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {threads.length} active threads
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedThreads.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center">
            <MessageSquare size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
            <p>No active threads yet.</p>
            <p className="text-sm mt-2">Highlight text or ask a general question to start.</p>
          </div>
        ) : (
          sortedThreads.map(thread => {
            const lastMessage =
              thread.messages.length > 0 ? thread.messages[thread.messages.length - 1] : null

            const isGeneral = thread.context === "Entire Document"

            return (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className="w-full text-left bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`p-1.5 rounded-md ${isGeneral ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"}`}
                    >
                      {isGeneral ? <FileText size={14} /> : <MessageSquare size={14} />}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate max-w-[180px]">
                      {thread.snippet}
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-slate-400 dark:text-slate-500">
                    <Clock size={10} className="mr-1" />
                    {getTimeString(lastMessage?.timestamp || thread.createdAt)}
                  </div>
                </div>

                <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3 h-[2.5em]">
                  {lastMessage ? (
                    <span
                      className={
                        lastMessage.role === "user"
                          ? "text-slate-500 dark:text-slate-500"
                          : "text-slate-800 dark:text-slate-300"
                      }
                    >
                      {lastMessage.role === "user" ? "You: " : "AI: "}
                      {lastMessage.text}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">No messages yet...</span>
                  )}
                </div>

                <div className="flex items-center text-blue-600 dark:text-blue-400 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Continue discussion <ArrowRight size={12} className="ml-1" />
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export default ThreadList
