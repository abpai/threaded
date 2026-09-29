import React from 'react'
import { Check, Clock, Loader2, Slash, X } from 'lucide-react'
import type { MeetingState, SideThread } from '../../live/types.ts'

export interface Draft {
  quote: string
  /** Utterances the user selected; empty for the "last 30 seconds" shortcut. */
  utteranceIds: string[]
  recentSeconds?: number
}

export const PRESETS = [
  {
    id: 'explain',
    label: 'Explain',
    question: 'Explain this briefly, in the context of this conversation.',
  },
  {
    id: 'check',
    label: 'Fact-check',
    question: 'Is this accurate? Check it against my files and tell me what they actually say.',
  },
  {
    id: 'find',
    label: 'Find in files',
    question: 'Find where this lives in my files and summarize what is there.',
  },
] as const

// Speaker dots only; transcript text stays in the neutral reading palette.
const SPEAKER_COLORS = ['#0891b2', '#7c3aed', '#d97706', '#059669', '#db2777', '#2563eb', '#65a30d']

export function speakerColor(meeting: MeetingState, id: string) {
  if (id === 'me') return '#64748b'
  const others = Object.keys(meeting.speakers)
    .filter(key => key !== 'me')
    .sort()
  const index = others.indexOf(id)
  return SPEAKER_COLORS[(index < 0 ? 0 : index) % SPEAKER_COLORS.length]
}

export function firstLine(markdown: string) {
  const line = markdown
    .split('\n')
    .map(l => l.trim())
    .find(l => l && !l.startsWith('```'))
  return (line ?? '')
    .replace(/^[-*#>\d.\s]+/, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

export function currentStep(thread: SideThread) {
  if (thread.status === 'queued') return 'Waiting for a free agent…'
  const turn = thread.messages.filter(m => m.role === 'user').at(-1)?.turn ?? 0
  const steps = thread.activity.filter(a => a.turn === turn)
  const running = steps.filter(a => a.status === 'running').at(-1)
  const answering = thread.messages.some(m => m.role === 'agent' && m.turn === turn && m.text)
  if (answering) return 'Writing the answer…'
  return (running ?? steps.at(-1))?.label ?? 'Starting…'
}

export const StatusIcon: React.FC<{ thread: SideThread; size?: number }> = ({
  thread,
  size = 14,
}) => {
  switch (thread.status) {
    case 'working':
      return <Loader2 size={size} className="animate-spin text-cyan-600 dark:text-accent" />
    case 'queued':
      return <Clock size={size} className="text-slate-400 dark:text-zinc-500" />
    case 'done':
      return <Check size={size} className="text-emerald-600 dark:text-emerald-400" />
    case 'failed':
      return <X size={size} className="text-red-500 dark:text-red-400" />
    case 'cancelled':
      return <Slash size={size} className="text-slate-400 dark:text-zinc-500" />
  }
}

export const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated text-[10px] font-sans text-slate-500 dark:text-zinc-400">
    {children}
  </kbd>
)

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
