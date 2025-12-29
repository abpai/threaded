import React, { useState } from 'react'
import { MessageSquarePlus, Copy, Sparkles, Check, Bookmark } from 'lucide-react'

interface TooltipProps {
  rect: DOMRect
  text: string
  onAction: (action: 'discuss' | 'summarize') => void
  onSaveQuote?: () => void
}

const TOOLTIP_HEIGHT = 50
const TOOLTIP_MARGIN = 10

const Tooltip: React.FC<TooltipProps> = ({ rect, text, onAction, onSaveQuote }) => {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const spaceAbove = rect.top
  const positionAbove = spaceAbove > TOOLTIP_HEIGHT + TOOLTIP_MARGIN

  const top = positionAbove ? rect.top - TOOLTIP_HEIGHT : rect.bottom + TOOLTIP_MARGIN

  const left = rect.left + rect.width / 2

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleSave = () => {
    if (onSaveQuote) {
      onSaveQuote()
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  return (
    <div
      className="fixed z-50 flex items-center gap-1 p-1 bg-slate-900 dark:bg-dark-elevated text-white rounded-lg shadow-xl transform -translate-x-1/2 animate-in fade-in zoom-in duration-200 border border-slate-700 dark:border-dark-border"
      style={{ top: `${top}px`, left: `${left}px` }}
      onMouseDown={e => e.preventDefault()}
    >
      <button
        onClick={() => onAction('discuss')}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 dark:hover:bg-zinc-600 rounded-md transition-colors text-sm font-medium"
      >
        <MessageSquarePlus size={16} />
        <span>Discuss</span>
      </button>

      <div className="w-px h-4 bg-slate-700 dark:bg-zinc-600 mx-1"></div>

      <button
        onClick={() => onAction('summarize')}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 dark:hover:bg-zinc-600 rounded-md transition-colors text-sm font-medium"
      >
        <Sparkles size={16} className="text-accent" />
        <span>Explain</span>
      </button>

      <div className="w-px h-4 bg-slate-700 dark:bg-zinc-600 mx-1"></div>

      {onSaveQuote && (
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 dark:hover:bg-zinc-600 rounded-md transition-colors text-sm font-medium"
          title="Save Quote"
        >
          <Bookmark
            size={16}
            className={saved ? 'text-amber-400 fill-amber-400' : 'text-amber-400'}
          />
          <span>{saved ? 'Saved' : 'Save'}</span>
        </button>
      )}

      {onSaveQuote && <div className="w-px h-4 bg-slate-700 dark:bg-zinc-600 mx-1"></div>}

      <button
        onClick={handleCopy}
        className="p-1.5 hover:bg-slate-700 dark:hover:bg-zinc-600 rounded-md transition-colors text-slate-400 hover:text-white"
        title="Copy"
      >
        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
      </button>

      {positionAbove ? (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 dark:border-t-dark-elevated" />
      ) : (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-slate-900 dark:border-b-dark-elevated" />
      )}
    </div>
  )
}

export default Tooltip
