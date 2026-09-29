import { useCallback, useEffect, useRef, useState } from 'react'
import { applyEvent } from '../live/meeting.ts'
import type { LiveEvent, LiveInfo, MeetingState, SideThread } from '../live/types.ts'

export interface LiveState {
  meeting: MeetingState
  info: LiveInfo
}

export async function liveRequest<T = { ok: true }>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/live${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return data as T
}

const settled = (thread: SideThread) =>
  thread.status === 'done' || thread.status === 'failed' || thread.status === 'cancelled'

/**
 * Subscribes to the local server's event stream. Events are applied in batches once per frame so
 * several agents streaming at once do not re-render the transcript for every token.
 */
export function useLiveMeeting(openThreadId: string | null) {
  const [state, setState] = useState<LiveState | null>(null)
  const [connected, setConnected] = useState(false)
  const [unread, setUnread] = useState<Set<string>>(new Set())
  const pending = useRef<LiveEvent[]>([])
  const latest = useRef<LiveState | null>(null)
  const openRef = useRef(openThreadId)
  openRef.current = openThreadId

  useEffect(() => {
    const source = new EventSource('/api/live/events')
    let scheduled: { frame?: number; timer?: ReturnType<typeof setTimeout> } | null = null
    const flush = () => {
      scheduled = null
      const events = pending.current
      pending.current = []
      const current = latest.current
      let next = current
      for (const event of events) {
        if (event.type === 'snapshot') next = { meeting: event.meeting, info: event.info }
        else if (next) next = { ...next, meeting: applyEvent(next.meeting, event) }
      }
      latest.current = next
      setState(next)
      if (!current || !next || current.meeting.id !== next.meeting.id) return
      // A thread that finishes while you are looking elsewhere is marked unread.
      const hidden = document.visibilityState === 'hidden'
      const fresh = next.meeting.threads
        .filter(t => {
          const before = current.meeting.threads.find(b => b.id === t.id)
          return settled(t) && before && !settled(before) && (hidden || t.id !== openRef.current)
        })
        .map(t => t.id)
      if (fresh.length) setUnread(set => new Set([...set, ...fresh]))
    }
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = message => {
      pending.current.push(JSON.parse(message.data) as LiveEvent)
      if (scheduled) return
      // Animation frames pause in background tabs, which is exactly when a call is happening.
      scheduled =
        document.visibilityState === 'hidden'
          ? { timer: setTimeout(flush, 250) }
          : { frame: requestAnimationFrame(flush) }
    }
    // A frame requested just before the tab was hidden would otherwise wait until it is shown.
    const onVisibility = () => {
      if (!scheduled?.frame) return
      cancelAnimationFrame(scheduled.frame)
      flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      source.close()
      document.removeEventListener('visibilitychange', onVisibility)
      if (scheduled?.frame) cancelAnimationFrame(scheduled.frame)
      if (scheduled?.timer) clearTimeout(scheduled.timer)
    }
  }, [])

  const markRead = useCallback((id: string) => {
    setUnread(set => {
      if (!set.has(id)) return set
      const next = new Set(set)
      next.delete(id)
      return next
    })
  }, [])

  return { state, connected, unread, markRead }
}
