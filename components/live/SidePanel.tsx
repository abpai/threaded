import React, { useMemo } from 'react'
import { History as HistoryIcon, MessagesSquare, X } from 'lucide-react'
import { isThreadActive } from '../../live/meeting.ts'
import type { LiveInfo, MeetingState, SideThread } from '../../live/types.ts'
import Composer from './Composer'
import ThreadDetail from './ThreadDetail'
import { currentStep, firstLine, isMac, Kbd, PRESETS, StatusIcon, type Draft } from './shared'

const ThreadCard: React.FC<{ thread: SideThread; unread: boolean; onOpen: () => void }> = ({
  thread,
  unread,
  onOpen,
}) => {
  const question = thread.messages.find(m => m.role === 'user')?.text ?? ''
  const lastAnswer = thread.messages.filter(m => m.role === 'agent' && m.text).at(-1)
  const active = isThreadActive(thread)
  const status = active
    ? currentStep(thread)
    : thread.status === 'failed'
      ? thread.error
      : thread.status === 'cancelled'
        ? 'Stopped'
        : lastAnswer
          ? firstLine(lastAnswer.text)
          : thread.error
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left p-3 rounded-xl border shadow-sm transition-colors ${
        unread
          ? 'bg-white dark:bg-dark-elevated border-cyan-200 dark:border-accent/40'
          : 'bg-white dark:bg-dark-elevated border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-zinc-500'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">
          <StatusIcon thread={thread} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 line-clamp-2">
            {question}
          </p>
          {thread.anchor && (
            <p className="mt-0.5 font-serif italic text-xs text-slate-400 dark:text-zinc-500 truncate">
              “{thread.anchor.quote}”
            </p>
          )}
          {status && (
            <p
              className={`mt-1.5 text-xs leading-relaxed line-clamp-2 ${
                thread.status === 'failed'
                  ? 'text-red-600 dark:text-red-400'
                  : active
                    ? 'text-cyan-700 dark:text-accent'
                    : 'text-slate-600 dark:text-zinc-300'
              }`}
            >
              {status}
            </p>
          )}
        </div>
        {unread && <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-accent" title="New" />}
      </div>
    </button>
  )
}

const DraftComposer: React.FC<{
  draft: Draft
  onAsk: (question: string) => Promise<boolean>
  onDismiss: () => void
}> = ({ draft, onAsk, onDismiss }) => (
  <div className="space-y-3">
    <div className="flex items-start gap-2">
      <p className="flex-1 border-l-2 border-accent pl-3 font-serif italic text-sm leading-relaxed text-slate-600 dark:text-zinc-300 line-clamp-4">
        {draft.recentSeconds && (
          <span className="not-italic font-sans text-xs font-medium text-slate-500 dark:text-zinc-400 block">
            Last {draft.recentSeconds} seconds
          </span>
        )}
        {draft.quote || 'Nothing has been said yet.'}
      </p>
      <button
        onClick={onDismiss}
        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-dark-elevated"
        title="Discard (Esc)"
      >
        <X size={15} />
      </button>
    </div>
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map(preset => (
        <button
          key={preset.id}
          type="button"
          onClick={() => void onAsk(preset.question)}
          className="px-2.5 py-1 text-xs rounded-full border border-slate-200 dark:border-dark-border text-slate-600 dark:text-zinc-300 hover:border-accent hover:text-cyan-700 dark:hover:text-accent transition-colors"
        >
          {preset.label}
        </button>
      ))}
    </div>
    <Composer
      autoFocus
      placeholder="Ask anything about this…"
      onSubmit={onAsk}
      onEscape={onDismiss}
    />
  </div>
)

interface SidePanelProps {
  meeting: MeetingState
  info: LiveInfo
  draft: Draft | null
  openThreadId: string | null
  unread: Set<string>
  onAsk: (question: string) => Promise<boolean>
  onDismissDraft: () => void
  onAskRecent: () => void
  onOpenThread: (id: string | null) => void
  onCancel: (id: string) => void
  onFollowUp: (id: string, question: string) => Promise<boolean>
  onJump: (utteranceIds: string[]) => void
}

const SidePanel: React.FC<SidePanelProps> = ({
  meeting,
  info,
  draft,
  openThreadId,
  unread,
  onAsk,
  onDismissDraft,
  onAskRecent,
  onOpenThread,
  onCancel,
  onFollowUp,
  onJump,
}) => {
  const threads = useMemo(
    () => [...meeting.threads].sort((a, b) => b.createdAt - a.createdAt),
    [meeting.threads]
  )
  const working = threads.filter(isThreadActive).length
  const open = threads.find(t => t.id === openThreadId)

  if (open && !draft)
    return (
      <ThreadDetail
        meeting={meeting}
        thread={open}
        onBack={() => onOpenThread(null)}
        onCancel={() => onCancel(open.id)}
        onFollowUp={question => onFollowUp(open.id, question)}
        onJump={onJump}
      />
    )

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-slate-200 dark:border-dark-border bg-white/90 dark:bg-dark-surface/90 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Side threads</h2>
        <span className="text-xs text-slate-500 dark:text-zinc-400">
          {working ? `${working} working` : threads.length ? `${threads.length} total` : ''}
        </span>
      </header>

      <div className="p-4 shrink-0 border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface">
        {draft ? (
          <DraftComposer draft={draft} onAsk={onAsk} onDismiss={onDismissDraft} />
        ) : (
          <button
            onClick={onAskRecent}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-dark-border text-sm text-slate-600 dark:text-zinc-300 hover:border-accent hover:text-cyan-700 dark:hover:text-accent transition-colors"
          >
            <span className="flex items-center gap-2">
              <HistoryIcon size={15} />
              Ask about the last 30 seconds
            </span>
            <Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {threads.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-400 dark:text-zinc-500">
            <MessagesSquare size={36} className="mb-3 text-slate-300 dark:text-zinc-600" />
            <p className="text-sm">Select anything that was said to ask about it.</p>
            <p className="text-xs mt-2 leading-relaxed">
              Each question runs as its own agent on your machine. Ask several at once; the
              conversation keeps going while they work.
            </p>
          </div>
        ) : (
          threads.map(thread => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              unread={unread.has(thread.id)}
              onOpen={() => onOpenThread(thread.id)}
            />
          ))
        )}
      </div>

      <footer className="px-4 py-2.5 shrink-0 border-t border-slate-200 dark:border-dark-border text-[11px] leading-relaxed text-slate-400 dark:text-zinc-500">
        <span className="font-medium text-slate-500 dark:text-zinc-400">{info.executor}</span> ·
        read-only · researching{' '}
        <span title={info.roots.join('\n')}>
          {info.roots.map(root => root.split('/').slice(-2).join('/')).join(', ')}
        </span>
      </footer>
    </div>
  )
}

export default SidePanel
