import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  Download,
  History,
  Mic,
  Moon,
  Plus,
  Sparkles,
  MessageSquarePlus,
  SearchCheck,
  Square,
  Sun,
} from 'lucide-react'
import { useDarkMode } from '../../hooks/useDarkMode'
import { liveRequest, useLiveMeeting } from '../../hooks/useLiveMeeting'
import { formatClock, meetingDuration, transcriptMarkdown } from '../../live/meeting.ts'
import type { MeetingState, MeetingSummary } from '../../live/types.ts'
import SidePanel from './SidePanel'
import Transcript, { type TranscriptSelection } from './Transcript'
import { PRESETS, type Draft } from './shared'

function useLiveClock(meeting: MeetingState | undefined) {
  const [now, setNow] = useState(Date.now())
  const listening = meeting?.audio.state === 'listening'
  useEffect(() => {
    if (!listening) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [listening])
  if (!meeting) return 0
  const { audio } = meeting
  if (listening && audio.startedAt)
    return Math.max(meetingDuration(meeting), (audio.offset ?? 0) + (now - audio.startedAt) / 1000)
  return meetingDuration(meeting)
}

function exportMarkdown(meeting: MeetingState) {
  const threads = meeting.threads
    .map(thread => {
      const lines = [`## ${thread.messages.find(m => m.role === 'user')?.text ?? 'Side thread'}`]
      if (thread.anchor) lines.push(`> ${thread.anchor.quote}`)
      for (const message of thread.messages)
        lines.push(message.role === 'user' ? `**You:** ${message.text}` : message.text)
      return lines.join('\n\n')
    })
    .join('\n\n')
  const content = `${transcriptMarkdown(meeting)}\n\n# Side threads\n\n${threads || '_None._'}\n`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${(meeting.title || 'meeting').replace(/[^\w-]+/g, '-').toLowerCase()}-${new Date(
    meeting.createdAt
  )
    .toISOString()
    .slice(0, 10)}.md`
  link.click()
  URL.revokeObjectURL(url)
}

const SelectionMenu: React.FC<{
  selection: TranscriptSelection
  onAsk: () => void
  onPreset: (question: string) => void
}> = ({ selection, onAsk, onPreset }) => {
  const above = selection.rect.top > 70
  const top = above ? selection.rect.top - 50 : selection.rect.bottom + 10
  const left = Math.min(
    Math.max(selection.rect.left + selection.rect.width / 2, 170),
    window.innerWidth - 170
  )
  const item =
    'flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 dark:hover:bg-zinc-600 rounded-md transition-colors text-sm font-medium'
  return (
    <div
      className="fixed z-50 flex items-center gap-1 p-1 bg-slate-900 dark:bg-dark-elevated text-white rounded-lg shadow-xl -translate-x-1/2 border border-slate-700 dark:border-dark-border"
      style={{ top, left }}
      onMouseDown={event => event.preventDefault()}
    >
      <button className={item} onClick={onAsk}>
        <MessageSquarePlus size={15} />
        Ask
      </button>
      <div className="w-px h-4 bg-slate-700 dark:bg-zinc-600" />
      <button className={item} onClick={() => onPreset(PRESETS[0].question)}>
        <Sparkles size={15} className="text-accent" />
        Explain
      </button>
      <div className="w-px h-4 bg-slate-700 dark:bg-zinc-600" />
      <button className={item} onClick={() => onPreset(PRESETS[1].question)}>
        <SearchCheck size={15} className="text-emerald-400" />
        Fact-check
      </button>
    </div>
  )
}

const LiveView: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const [openThreadId, setOpenThreadId] = useState<string | null>(null)
  const { state, connected, unread, markRead } = useLiveMeeting(openThreadId)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selection, setSelection] = useState<TranscriptSelection | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<MeetingSummary[] | null>(null)
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [following, setFollowing] = useState(true)
  const [flash, setFlash] = useState<string[]>([])
  const scroller = useRef<HTMLDivElement>(null)
  const meeting = state?.meeting
  const elapsed = useLiveClock(meeting)

  const report = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e))
  }, [])
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(''), 6000)
    return () => clearTimeout(timer)
  }, [error])

  // Keep local edit fields in sync when the meeting changes underneath them.
  const meetingId = meeting?.id
  useEffect(() => {
    setTitle(meeting?.title ?? '')
    setBrief(meeting?.brief ?? '')
    setOpenThreadId(null)
    setDraft(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId])

  useEffect(() => {
    if (openThreadId) markRead(openThreadId)
  }, [openThreadId, markRead, meeting?.threads])

  useEffect(() => {
    document.title = unread.size ? `(${unread.size}) Threaded Live` : 'Threaded Live'
  }, [unread])

  // Follow the conversation unless the user has scrolled up to read.
  const partialText = `${meeting?.partials.me?.text ?? ''}|${meeting?.partials.them?.text ?? ''}`
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && following) el.scrollTop = el.scrollHeight
  }, [meeting?.utterances.length, partialText, following])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
    if (selection) setSelection(null)
  }

  const startThread = useCallback(
    async (question: string, from: Draft) => {
      try {
        const { threadId } = await liveRequest<{ threadId: string }>('/threads', {
          question,
          ...(from.recentSeconds
            ? { recentSeconds: from.recentSeconds }
            : { utteranceIds: from.utteranceIds, quote: from.quote }),
        })
        setDraft(null)
        setSelection(null)
        window.getSelection()?.removeAllRanges()
        return !!threadId
      } catch (e) {
        report(e)
        return false
      }
    },
    [report]
  )

  const askRecent = useCallback(() => {
    if (!meeting) return
    const since = meetingDuration(meeting) - 30
    const recent = meeting.utterances.filter(u => u.end >= since)
    setSelection(null)
    setOpenThreadId(null)
    setDraft({
      quote: recent.map(u => u.text).join(' '),
      utteranceIds: recent.map(u => u.id),
      recentSeconds: 30,
    })
  }, [meeting])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        askRecent()
      } else if (event.key === 'Escape') {
        if (selection) setSelection(null)
        else if (draft) setDraft(null)
        else if (openThreadId) setOpenThreadId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [askRecent, selection, draft, openThreadId])

  const rename = useCallback(
    (id: string, name: string) =>
      void liveRequest(`/speakers/${encodeURIComponent(id)}`, { name }).catch(report),
    [report]
  )

  const jumpTo = useCallback((ids: string[]) => {
    const el = scroller.current?.querySelector(`[data-utterance-id="${CSS.escape(ids[0])}"]`)
    if (!el) return
    setFollowing(false)
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFlash(ids)
    setTimeout(() => setFlash([]), 1600)
  }, [])

  if (!state || !meeting)
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-white dark:bg-dark-base text-slate-500 dark:text-zinc-400 px-6 text-center">
        <p className="font-serif text-2xl text-slate-800 dark:text-zinc-100">Threaded Live</p>
        <p className="text-sm">
          {connected ? 'Loading…' : 'Connecting to the local server. Is `pnpm live` running?'}
        </p>
      </div>
    )

  const { audio } = meeting
  const busy =
    audio.state === 'starting' || audio.state === 'listening' || audio.state === 'stopping'
  const iconButton =
    'p-2 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-dark-elevated transition-colors disabled:opacity-40 disabled:pointer-events-none'

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-dark-base text-slate-800 dark:text-zinc-100">
      <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-slate-200 dark:border-dark-border bg-white/90 dark:bg-dark-base/90 backdrop-blur-sm z-20">
        <a href="/" className="font-serif font-bold text-lg tracking-tight">
          threaded
        </a>
        <span className="text-xs font-medium uppercase tracking-wider text-cyan-700 dark:text-accent">
          live
        </span>
        <span className="text-slate-200 dark:text-zinc-700">|</span>
        <input
          value={title}
          onChange={event => setTitle(event.target.value)}
          onBlur={() =>
            title !== meeting.title && void liveRequest('/meeting', { title }).catch(report)
          }
          onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()}
          placeholder="Untitled meeting"
          aria-label="Meeting title"
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none"
        />
        <span
          className={`hidden sm:flex items-center gap-2 text-xs tabular-nums ${
            audio.state === 'error'
              ? 'text-red-600 dark:text-red-400'
              : 'text-slate-500 dark:text-zinc-400'
          }`}
        >
          {audio.state === 'listening' && (
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-red-400 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-red-500" />
            </span>
          )}
          {audio.state === 'listening'
            ? `Listening · ${formatClock(elapsed)}`
            : audio.state === 'starting'
              ? 'Starting…'
              : audio.state === 'stopping'
                ? 'Finishing…'
                : audio.state === 'error'
                  ? 'Audio error'
                  : (state.info.source ?? 'No transcript source')}
        </span>
        <button
          disabled={!state.info.source || audio.state === 'stopping' || !connected}
          onClick={() => void liveRequest(busy ? '/audio/stop' : '/audio/start', {}).catch(report)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
            busy
              ? 'border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
              : 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-slate-700 dark:hover:bg-white'
          }`}
        >
          {busy ? <Square size={13} /> : <Mic size={14} />}
          {busy ? 'Stop' : meeting.utterances.length ? 'Resume' : 'Start listening'}
        </button>
        <div className="relative flex items-center">
          <button
            className={iconButton}
            title="Meetings"
            onClick={() =>
              history
                ? setHistory(null)
                : void liveRequest<MeetingSummary[]>('/meetings').then(setHistory).catch(report)
            }
          >
            <History size={17} />
          </button>
          <button
            className={iconButton}
            title="Export as Markdown"
            onClick={() => exportMarkdown(meeting)}
          >
            <Download size={17} />
          </button>
          <button className={iconButton} title="Toggle theme" onClick={toggleDarkMode}>
            {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {history && (
            <div className="absolute right-0 top-11 w-80 max-h-96 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl">
              <button
                onClick={() =>
                  void liveRequest('/meetings/new', {})
                    .then(() => setHistory(null))
                    .catch(report)
                }
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-dark-elevated"
              >
                <Plus size={15} /> New meeting
              </button>
              <div className="my-1 border-t border-slate-100 dark:border-dark-border" />
              {history.map(item => (
                <button
                  key={item.id}
                  disabled={item.id === meeting.id}
                  onClick={() =>
                    void liveRequest(`/meetings/${item.id}/open`, {})
                      .then(() => setHistory(null))
                      .catch(report)
                  }
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-elevated disabled:bg-slate-50 dark:disabled:bg-dark-elevated/60"
                >
                  <p className="text-sm text-slate-700 dark:text-zinc-200 truncate">
                    {item.title || 'Untitled meeting'}
                    {item.id === meeting.id && (
                      <span className="text-xs text-slate-400 dark:text-zinc-500"> · open</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    · {item.utterances} lines · {item.threads} threads
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {!connected && (
        <div className="px-4 py-2 text-sm text-center bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800/50">
          Reconnecting to Threaded Live… Side threads keep running on your machine.
        </div>
      )}
      {audio.state === 'error' && audio.error && (
        <div className="px-4 py-2 text-sm text-center bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-800/50">
          {audio.error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <div className="relative flex-1 min-h-0">
          <main ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto">
            <div className="max-w-[720px] mx-auto px-6 pt-8 pb-32">
              <textarea
                value={brief}
                onChange={event => setBrief(event.target.value)}
                onBlur={() =>
                  brief !== meeting.brief && void liveRequest('/meeting', { brief }).catch(report)
                }
                rows={brief ? 2 : 1}
                placeholder="What is this call about? Side threads get this as context."
                aria-label="Meeting brief"
                className="w-full mb-6 px-0 py-1 bg-transparent resize-none text-sm text-slate-500 dark:text-zinc-400 placeholder:text-slate-400 dark:placeholder:text-zinc-500 border-0 border-b border-transparent hover:border-slate-200 focus:border-accent dark:hover:border-dark-border focus:outline-none transition-colors"
              />
              {meeting.utterances.length === 0 && !meeting.partials.them && !meeting.partials.me ? (
                <div className="py-20 text-center">
                  <h2 className="font-serif text-2xl text-slate-800 dark:text-zinc-100 mb-3">
                    Listen. Select. Branch off.
                  </h2>
                  <p className="text-slate-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                    {state.info.source
                      ? 'Press Start listening. Select anything that is said to ask about it; each question becomes a side thread that researches your files while the conversation carries on.'
                      : 'No transcript source is configured. Restart with `pnpm live --replay live/fixtures/demo-call.txt` to try it, or `--audio <helper>` for live audio.'}
                  </p>
                </div>
              ) : (
                <Transcript
                  meeting={meeting}
                  activeThreadId={openThreadId}
                  highlightIds={flash}
                  onSelection={setSelection}
                  onOpenThread={setOpenThreadId}
                  onRename={rename}
                />
              )}
            </div>
          </main>
          {!following && (
            <button
              onClick={() => setFollowing(true)}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowDown size={14} />
              {busy ? 'Jump to live' : 'Jump to end'}
            </button>
          )}
        </div>
        <aside className="md:w-[440px] h-[45vh] md:h-auto shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface">
          <SidePanel
            meeting={meeting}
            info={state.info}
            draft={draft}
            openThreadId={openThreadId}
            unread={unread}
            onAsk={question => (draft ? startThread(question, draft) : Promise.resolve(false))}
            onDismissDraft={() => setDraft(null)}
            onAskRecent={askRecent}
            onOpenThread={setOpenThreadId}
            onCancel={id => void liveRequest(`/threads/${id}/cancel`, {}).catch(report)}
            onFollowUp={(id, question) =>
              liveRequest(`/threads/${id}/messages`, { question })
                .then(() => true)
                .catch(e => {
                  report(e)
                  return false
                })
            }
            onJump={jumpTo}
          />
        </aside>
      </div>

      {selection && !draft && (
        <SelectionMenu
          selection={selection}
          onAsk={() => {
            setDraft({ quote: selection.quote, utteranceIds: selection.utteranceIds })
            setOpenThreadId(null)
            setSelection(null)
          }}
          onPreset={question =>
            void startThread(question, {
              quote: selection.quote,
              utteranceIds: selection.utteranceIds,
            })
          }
        />
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-4 max-w-sm px-4 py-3 rounded-xl shadow-lg text-sm bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
        >
          {error}
        </div>
      )}
    </div>
  )
}

export default LiveView
