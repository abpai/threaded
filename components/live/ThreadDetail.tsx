import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Brain,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Globe,
  Loader2,
  MessageSquare,
  Search,
  Square,
  Terminal,
  Wrench,
} from 'lucide-react'
import MarkdownRenderer from '../MarkdownRenderer'
import { formatClock, isThreadActive, speakerName } from '../../live/meeting.ts'
import type { Activity, ActivityKind, MeetingState, SideThread } from '../../live/types.ts'
import Composer from './Composer'
import { StatusIcon } from './shared'

const KIND_ICONS: Record<ActivityKind, React.ElementType> = {
  read: FileText,
  search: Search,
  list: FolderOpen,
  command: Terminal,
  web: Globe,
  tool: Wrench,
  thinking: Brain,
  note: MessageSquare,
}

const STATUS_TEXT: Record<SideThread['status'], string> = {
  queued: 'Queued',
  working: 'Researching',
  done: 'Answered',
  failed: 'Failed',
  cancelled: 'Stopped',
}

function summarize(steps: Activity[]) {
  const count = (kinds: ActivityKind[]) => steps.filter(s => kinds.includes(s.kind)).length
  const parts = [
    [count(['read']), 'file read', 'file reads'],
    [count(['search', 'list']), 'search', 'searches'],
    [count(['command']), 'command', 'commands'],
    [count(['web']), 'web lookup', 'web lookups'],
    [count(['tool']), 'tool call', 'tool calls'],
  ] as const
  return (
    parts
      .filter(([n]) => n > 0)
      .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
      .join(' · ') || `${steps.length} steps`
  )
}

const Step: React.FC<{ step: Activity }> = ({ step }) => {
  const Icon = KIND_ICONS[step.kind]
  return (
    <li className="flex items-start gap-2 py-0.5" title={step.detail}>
      {step.status === 'running' ? (
        <Loader2
          size={13}
          className="mt-0.5 shrink-0 animate-spin text-cyan-600 dark:text-accent"
        />
      ) : (
        <Icon
          size={13}
          className={`mt-0.5 shrink-0 ${step.status === 'failed' ? 'text-red-400' : 'text-slate-400 dark:text-zinc-500'}`}
        />
      )}
      <span
        className={`min-w-0 break-words ${step.kind === 'thinking' || step.kind === 'note' ? 'italic' : ''}`}
      >
        {step.label}
      </span>
    </li>
  )
}

const ActivityBlock: React.FC<{ steps: Activity[]; live: boolean }> = ({ steps, live }) => {
  const [expanded, setExpanded] = useState(false)
  if (!steps.length)
    return live ? (
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
        <Loader2 size={13} className="animate-spin text-cyan-600 dark:text-accent" />
        Starting…
      </div>
    ) : null
  const visible = expanded ? steps : live ? steps.slice(-4) : []
  return (
    <div className="text-xs text-slate-500 dark:text-zinc-400">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 font-medium hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {live ? 'Working' : 'Researched'} · {summarize(steps)}
      </button>
      {visible.length > 0 && (
        <ul className="mt-1.5 ml-1 pl-3 border-l border-slate-200 dark:border-dark-border">
          {!expanded && steps.length > visible.length && (
            <li className="py-0.5 text-slate-400 dark:text-zinc-500">
              {steps.length - visible.length} earlier steps
            </li>
          )}
          {visible.map(step => (
            <Step key={step.id} step={step} />
          ))}
        </ul>
      )}
    </div>
  )
}

interface ThreadDetailProps {
  meeting: MeetingState
  thread: SideThread
  onBack: () => void
  onCancel: () => void
  onFollowUp: (question: string) => Promise<boolean>
  onJump: (utteranceIds: string[]) => void
}

const ThreadDetail: React.FC<ThreadDetailProps> = ({
  meeting,
  thread,
  onBack,
  onCancel,
  onFollowUp,
  onJump,
}) => {
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const active = isThreadActive(thread)
  const turns = useMemo(
    () => [...new Set(thread.messages.map(m => m.turn))].sort((a, b) => a - b),
    [thread.messages]
  )
  const lastTurn = turns.at(-1) ?? 0
  const who = useMemo(() => {
    const ids = meeting.utterances
      .filter(u => thread.anchor?.utteranceIds.includes(u.id))
      .map(u => u.speaker)
    return [...new Set(ids)].map(id => speakerName(meeting, id)).join(', ')
  }, [meeting, thread.anchor])

  useEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [thread])

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-3 h-14 shrink-0 border-b border-slate-200 dark:border-dark-border bg-white/90 dark:bg-dark-surface/90 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-elevated transition-colors"
          title="All side threads (Esc)"
        >
          <ArrowLeft size={18} />
        </button>
        <StatusIcon thread={thread} />
        <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">
          {STATUS_TEXT[thread.status]}
        </span>
        <span className="text-xs text-slate-400 dark:text-zinc-500">· {thread.executor}</span>
        <div className="flex-1" />
        {active && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-dark-border text-slate-600 dark:text-zinc-300 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Square size={11} />
            Stop
          </button>
        )}
      </header>

      <div
        ref={scroller}
        onScroll={event => {
          const el = event.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
        }}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
      >
        {thread.anchor && (
          <button
            type="button"
            onClick={() => onJump(thread.anchor!.utteranceIds)}
            className="block w-full text-left border-l-2 border-accent pl-3 py-0.5 group"
            title="Show in transcript"
          >
            <p className="font-serif italic text-sm leading-relaxed text-slate-600 dark:text-zinc-300 line-clamp-5">
              {thread.anchor.quote}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500 group-hover:text-cyan-700 dark:group-hover:text-accent transition-colors">
              {thread.anchor.via === 'recent' ? 'Last 30 seconds' : who} ·{' '}
              {formatClock(thread.anchor.start)}
            </p>
          </button>
        )}

        {turns.map(turn => {
          const questions = thread.messages.filter(m => m.turn === turn && m.role === 'user')
          const answers = thread.messages.filter(
            m => m.turn === turn && m.role === 'agent' && m.text
          )
          const steps = thread.activity.filter(a => a.turn === turn)
          const live = active && turn === lastTurn
          return (
            <div key={turn} className="space-y-3">
              {questions.map(message => (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-none px-3 py-2 text-sm leading-relaxed bg-slate-800 dark:bg-zinc-700 text-white whitespace-pre-wrap">
                    {message.text}
                  </div>
                </div>
              ))}
              <ActivityBlock steps={steps} live={live && !answers.length} />
              {answers.map(message => (
                <div
                  key={message.id}
                  className="rounded-2xl rounded-tl-none p-3 text-sm leading-relaxed bg-white dark:bg-dark-elevated border border-slate-100 dark:border-dark-border text-slate-700 dark:text-zinc-200 shadow-sm markdown-chat"
                >
                  <MarkdownRenderer content={message.text} />
                </div>
              ))}
            </div>
          )
        })}

        {thread.error && (
          <div className="rounded-xl px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
            {thread.error}
          </div>
        )}
      </div>

      <div className="p-3 shrink-0 border-t border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface">
        <Composer
          key={thread.id}
          placeholder={
            thread.status === 'working'
              ? 'Add to this while it works…'
              : thread.status === 'queued'
                ? 'Waiting to start…'
                : 'Follow up…'
          }
          disabled={thread.status === 'queued'}
          onSubmit={onFollowUp}
        />
      </div>
    </div>
  )
}

export default ThreadDetail
