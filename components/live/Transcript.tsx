import React, { useCallback, useMemo, useRef, useState } from 'react'
import { formatClock, groupTurns, speakerName, type Turn } from '../../live/meeting.ts'
import type { MeetingState, PartialText, Speaker } from '../../live/types.ts'
import { speakerColor } from './shared'

export interface TranscriptSelection {
  quote: string
  utteranceIds: string[]
  rect: DOMRect
}

interface TranscriptProps {
  meeting: MeetingState
  activeThreadId: string | null
  highlightIds: string[]
  onSelection: (selection: TranscriptSelection | null) => void
  onOpenThread: (threadId: string) => void
  onRename: (speakerId: string, name: string) => void
}

const SpeakerLabel: React.FC<{
  speaker: Speaker | undefined
  id: string
  name: string
  color: string
  onRename: (speakerId: string, name: string) => void
}> = ({ speaker, id, name, color, onRename }) => {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const canRename = id !== 'me'

  if (editing)
    return (
      <form
        onSubmit={event => {
          event.preventDefault()
          if (value.trim()) onRename(id, value.trim())
          setEditing(false)
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={event => setValue(event.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={event => event.key === 'Escape' && setEditing(false)}
          aria-label="Speaker name"
          className="w-40 px-2 py-0.5 -my-0.5 text-sm font-semibold rounded-md border border-accent bg-white dark:bg-dark-elevated text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </form>
    )

  return (
    <button
      type="button"
      disabled={!canRename}
      onClick={() => {
        setValue(name)
        setEditing(true)
      }}
      title={
        canRename ? (speaker?.named ? 'Rename' : 'Who is this? Click to name them') : undefined
      }
      className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-zinc-100 enabled:hover:text-cyan-700 dark:enabled:hover:text-accent transition-colors"
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {name}
      {canRename && !speaker?.named && /^Speaker \d+$/.test(name) && (
        <span className="text-xs font-normal text-slate-400 dark:text-zinc-500">· name</span>
      )}
    </button>
  )
}

type TurnViewProps = React.ComponentProps<typeof TurnViewInner>

// Turns are rebuilt on every utterance, but their utterance objects keep identity, so compare those.
function sameTurnProps(a: TurnViewProps, b: TurnViewProps) {
  return (
    a.name === b.name &&
    a.speaker === b.speaker &&
    a.color === b.color &&
    a.anchors === b.anchors &&
    a.activeIds === b.activeIds &&
    a.highlightIds === b.highlightIds &&
    a.onRename === b.onRename &&
    a.turn.speaker === b.turn.speaker &&
    a.turn.utterances.length === b.turn.utterances.length &&
    a.turn.utterances.every((u, i) => u === b.turn.utterances[i])
  )
}

function TurnViewInner({
  turn,
  name,
  speaker,
  color,
  anchors,
  activeIds,
  highlightIds,
  onRename,
}: {
  turn: Turn
  name: string
  speaker: Speaker | undefined
  color: string
  /** utteranceId → thread ids, only for this turn's utterances. */
  anchors: string
  activeIds: string
  highlightIds: string
  onRename: (speakerId: string, name: string) => void
}) {
  const anchorMap: Record<string, string[]> = anchors ? JSON.parse(anchors) : {}
  return (
    <section className="py-3" data-turn-id={turn.id}>
      <header className="flex items-baseline gap-3 mb-1 select-none">
        <SpeakerLabel
          speaker={speaker}
          id={turn.speaker}
          name={name}
          color={color}
          onRename={onRename}
        />
        <time className="text-xs tabular-nums text-slate-400 dark:text-zinc-500">
          {formatClock(turn.start)}
        </time>
      </header>
      <p className="font-serif text-[1.0625rem] leading-[1.85] tracking-[0.01em] text-slate-700 dark:text-zinc-300">
        {turn.utterances.map(u => {
          const threads = anchorMap[u.id]
          const highlighted = highlightIds.includes(u.id)
          return (
            <React.Fragment key={u.id}>
              <span
                data-utterance-id={u.id}
                data-thread-ids={threads?.join(',')}
                data-thread-active={threads && activeIds.includes(u.id) ? 'true' : undefined}
                className={`${threads ? 'thread-anchor' : ''} ${
                  highlighted ? 'bg-blue-100/70 dark:bg-accent-glow rounded-sm' : ''
                }`}
              >
                {u.text}
              </span>{' '}
            </React.Fragment>
          )
        })}
      </p>
    </section>
  )
}

const TurnView = React.memo(TurnViewInner, sameTurnProps)

const PartialLine: React.FC<{
  partial: PartialText
  name: string
  color: string
  continuation: boolean
}> = ({ partial, name, color, continuation }) => (
  <section className={continuation ? 'pb-3 -mt-3' : 'py-3'} aria-live="off">
    {!continuation && (
      <header className="flex items-baseline gap-3 mb-1 select-none">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-zinc-400">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          {name}
        </span>
        <time className="text-xs tabular-nums text-slate-400 dark:text-zinc-500">
          {formatClock(partial.start)}
        </time>
      </header>
    )}
    <p className="font-serif text-[1.0625rem] leading-[1.85] tracking-[0.01em] text-slate-400 dark:text-zinc-500 select-none">
      {partial.text}
      <span className="inline-block w-[2px] h-[1.1em] ml-1 align-[-0.15em] bg-cyan-500/70 animate-pulse" />
    </p>
  </section>
)

const Transcript: React.FC<TranscriptProps> = ({
  meeting,
  activeThreadId,
  highlightIds,
  onSelection,
  onOpenThread,
  onRename,
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const turns = useMemo(() => groupTurns(meeting.utterances), [meeting.utterances])

  // utteranceId → thread ids, newest thread last.
  const anchorIndex = useMemo(() => {
    const index: Record<string, string[]> = {}
    for (const thread of meeting.threads)
      for (const id of thread.anchor?.via === 'selection' ? thread.anchor.utteranceIds : [])
        (index[id] ??= []).push(thread.id)
    return index
  }, [meeting.threads])

  const activeUtterances = useMemo(() => {
    const thread = meeting.threads.find(t => t.id === activeThreadId)
    return thread?.anchor?.utteranceIds ?? []
  }, [meeting.threads, activeThreadId])

  const readSelection = useCallback(() => {
    const selection = window.getSelection()
    const root = ref.current
    if (!selection || selection.isCollapsed || !root) return onSelection(null)
    const range = selection.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return
    const quote = selection.toString().replace(/\s+/g, ' ').trim()
    const utteranceIds = Array.from(root.querySelectorAll<HTMLElement>('[data-utterance-id]'))
      .filter(el => range.intersectsNode(el))
      .map(el => el.dataset.utteranceId!)
    if (!quote || !utteranceIds.length) return onSelection(null)
    onSelection({ quote, utteranceIds, rect: range.getBoundingClientRect() })
  }, [onSelection])

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      if (!window.getSelection()?.isCollapsed) return
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-thread-ids]')
      const ids = target?.dataset.threadIds?.split(',').filter(Boolean)
      if (ids?.length) onOpenThread(ids[ids.length - 1])
    },
    [onOpenThread]
  )

  const lastTurn = turns.at(-1)
  const partials = (['them', 'me'] as const)
    .map(channel => meeting.partials[channel])
    .filter((p): p is PartialText => !!p && !!p.text.trim())

  return (
    <div ref={ref} onMouseUp={readSelection} onKeyUp={readSelection} onClick={onClick}>
      {turns.map(turn => {
        const own = turn.utterances.filter(u => anchorIndex[u.id])
        const anchors = own.length
          ? JSON.stringify(Object.fromEntries(own.map(u => [u.id, anchorIndex[u.id]])))
          : ''
        const inTurn = (ids: string[]) =>
          ids.filter(id => turn.utterances.some(u => u.id === id)).join(',')
        return (
          <TurnView
            key={turn.id}
            turn={turn}
            name={speakerName(meeting, turn.speaker)}
            speaker={meeting.speakers[turn.speaker]}
            color={speakerColor(meeting, turn.speaker)}
            anchors={anchors}
            activeIds={inTurn(activeUtterances)}
            highlightIds={inTurn(highlightIds)}
            onRename={onRename}
          />
        )
      })}
      {partials.map(partial => {
        const speaker = partial.speaker ?? (partial.channel === 'me' ? 'me' : 'them')
        return (
          <PartialLine
            key={partial.channel}
            partial={partial}
            name={speakerName(meeting, speaker)}
            color={speakerColor(meeting, speaker)}
            continuation={
              partials.length === 1 &&
              lastTurn?.speaker === speaker &&
              partial.start - lastTurn.end < 20
            }
          />
        )
      })}
    </div>
  )
}

export default Transcript
