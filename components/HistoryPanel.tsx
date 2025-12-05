import React, { useState, useRef, useCallback } from "react"
import { Clock, Plus, Trash2, FileText, History, ChevronRight } from "lucide-react"
import { SessionMeta } from "../types"
import { formatRelativeTime } from "../lib/formatTime"

interface HistoryPanelProps {
  sessions: SessionMeta[]
  currentSessionId: string | null
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onNewSession: () => void
  isOpen?: boolean
  onToggle?: () => void
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  isOpen,
  onToggle,
}) => {
  const [isHoverExpanded, setIsHoverExpanded] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Panel is open if EITHER external control OR hover says open
  const isExpanded = (isOpen ?? false) || isHoverExpanded

  const handleMouseEnter = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = null
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverExpanded(true)
    }, 150)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    leaveTimeoutRef.current = setTimeout(() => {
      setIsHoverExpanded(false)
      if (onToggle && isOpen) {
        onToggle()
      }
    }, 300)
  }, [isOpen, onToggle])

  const closePanel = useCallback(() => {
    setIsHoverExpanded(false)
    if (isOpen && onToggle) {
      onToggle()
    }
  }, [isOpen, onToggle])

  return (
    <>
      {/* Collapsed hover trigger - left edge indicator */}
      <div
        className={`fixed left-0 top-0 h-full z-50 transition-all duration-300 ${
          isExpanded ? "w-0 opacity-0" : "w-3 opacity-100"
        }`}
        onMouseEnter={handleMouseEnter}
      >
        <div className="h-full w-full bg-gradient-to-r from-slate-200 to-transparent dark:from-neutral-700 dark:to-transparent hover:from-blue-400 dark:hover:from-blue-500 transition-colors cursor-pointer flex items-center justify-center">
          <ChevronRight
            size={12}
            className="text-slate-400 dark:text-neutral-500 opacity-0 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>

      {/* Expanded panel overlay */}
      <div
        className={`fixed left-0 top-0 h-full z-50 transition-all duration-300 ease-in-out ${
          isExpanded ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={`h-full bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800 shadow-2xl transition-transform duration-300 ease-in-out ${
            isExpanded ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ width: "280px" }}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
              <div className="flex items-center gap-2">
                <History size={18} className="text-slate-500 dark:text-neutral-400" />
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-neutral-100">History</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">
                    {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
                  </p>
                </div>
              </div>
              <button
                onClick={e => {
                  e.stopPropagation()
                  onNewSession()
                  closePanel()
                }}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                title="New session"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sessions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-neutral-500 text-center px-4">
                  <FileText size={36} className="mb-3 text-slate-300 dark:text-neutral-600" />
                  <p className="text-sm">No sessions yet</p>
                  <p className="text-xs mt-1">Paste content to start reading</p>
                </div>
              ) : (
                sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => {
                      onSelectSession(session.id)
                      closePanel()
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all group relative ${
                      session.id === currentSessionId
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                        : "bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 hover:border-slate-300 dark:hover:border-neutral-600 hover:shadow-sm"
                    }`}
                  >
                    {/* Delete button */}
                    <div
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => {
                        e.stopPropagation()
                        onDeleteSession(session.id)
                      }}
                    >
                      <span className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-600 dark:hover:text-red-400 inline-flex cursor-pointer">
                        <Trash2 size={14} />
                      </span>
                    </div>

                    {/* Title */}
                    <div className="font-medium text-sm text-slate-700 dark:text-neutral-200 truncate pr-6">
                      {session.title}
                    </div>

                    {/* Summary */}
                    <div className="text-xs text-slate-500 dark:text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                      {session.summary || "No summary available"}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 dark:text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatRelativeTime(session.lastModified)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default HistoryPanel
