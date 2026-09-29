// Pure meeting-state helpers shared by the server and the UI.
import type { LiveEvent, MeetingState, SideThread, Speaker, Utterance } from './types.ts'

export const ME: Speaker = { id: 'me', name: 'You', channel: 'me', named: true }

export function newMeeting(id: string, now = Date.now()): MeetingState {
  return {
    id,
    title: '',
    brief: '',
    createdAt: now,
    audio: { state: 'idle' },
    speakers: { me: ME },
    utterances: [],
    partials: {},
    threads: [],
  }
}

function upsertThread(threads: SideThread[], thread: SideThread) {
  const index = threads.findIndex(t => t.id === thread.id)
  if (index < 0) return [...threads, thread]
  const next = threads.slice()
  next[index] = thread
  return next
}

function updateThread(
  meeting: MeetingState,
  threadId: string,
  update: (thread: SideThread) => SideThread
): MeetingState {
  const thread = meeting.threads.find(t => t.id === threadId)
  if (!thread) return meeting
  return { ...meeting, threads: upsertThread(meeting.threads, update(thread)) }
}

/** Applies one event and returns the next state. Never mutates its input. */
export function applyEvent(meeting: MeetingState, event: LiveEvent): MeetingState {
  switch (event.type) {
    case 'snapshot':
      return event.meeting
    case 'meeting':
      return {
        ...meeting,
        title: event.title ?? meeting.title,
        brief: event.brief ?? meeting.brief,
      }
    case 'audio':
      return { ...meeting, audio: event.audio }
    case 'speaker':
      return { ...meeting, speakers: { ...meeting.speakers, [event.speaker.id]: event.speaker } }
    case 'utterance': {
      const u = event.utterance
      const rest = meeting.utterances.filter(x => x.id !== u.id)
      // Utterances nearly always arrive in order; walk back from the end to place late ones.
      let index = rest.length
      while (index > 0 && rest[index - 1].start > u.start) index--
      const utterances = [...rest.slice(0, index), u, ...rest.slice(index)]
      const partial = meeting.partials[u.channel]
      const partials =
        partial && partial.start <= u.end
          ? { ...meeting.partials, [u.channel]: undefined }
          : meeting.partials
      return { ...meeting, utterances, partials }
    }
    case 'relabel':
      return {
        ...meeting,
        utterances: meeting.utterances.map(u =>
          u.id === event.id ? { ...u, speaker: event.speaker } : u
        ),
      }
    case 'partial':
      return {
        ...meeting,
        partials: { ...meeting.partials, [event.channel]: event.partial ?? undefined },
      }
    case 'thread':
      return { ...meeting, threads: upsertThread(meeting.threads, event.thread) }
    case 'thread-text':
      return updateThread(meeting, event.threadId, thread => ({
        ...thread,
        messages: thread.messages.map(m =>
          m.id === event.messageId ? { ...m, text: m.text + event.delta } : m
        ),
      }))
    case 'thread-activity':
      return updateThread(meeting, event.threadId, thread => {
        const index = thread.activity.findIndex(a => a.id === event.activity.id)
        const activity = thread.activity.slice()
        if (index < 0) activity.push(event.activity)
        else activity[index] = event.activity
        return { ...thread, activity }
      })
  }
}

export function speakerName(meeting: MeetingState, id: string) {
  return meeting.speakers[id]?.name ?? (id === 'me' ? 'You' : 'Unknown speaker')
}

export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = (s % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export interface Turn {
  id: string
  speaker: string
  channel: Utterance['channel']
  start: number
  end: number
  utterances: Utterance[]
}

/** Consecutive utterances from one speaker read as a single turn, unless there is a long pause. */
export function groupTurns(utterances: Utterance[], maxGap = 20): Turn[] {
  const turns: Turn[] = []
  for (const u of utterances) {
    const last = turns.at(-1)
    if (last && last.speaker === u.speaker && u.start - last.end <= maxGap) {
      last.utterances.push(u)
      last.end = Math.max(last.end, u.end)
    } else {
      turns.push({
        id: u.id,
        speaker: u.speaker,
        channel: u.channel,
        start: u.start,
        end: u.end,
        utterances: [u],
      })
    }
  }
  return turns
}

/** Plain-text transcript lines, one per speaker turn: "[12:03] Priya: ..." */
export function formatTranscript(meeting: MeetingState, utterances: Utterance[]) {
  return groupTurns(utterances)
    .map(
      turn =>
        `[${formatClock(turn.start)}] ${speakerName(meeting, turn.speaker)}: ${turn.utterances
          .map(u => u.text)
          .join(' ')}`
    )
    .join('\n')
}

export function transcriptMarkdown(meeting: MeetingState) {
  const title = meeting.title || `Meeting ${new Date(meeting.createdAt).toLocaleString()}`
  const lines = [`# ${title}`, '']
  if (meeting.brief) lines.push(`> ${meeting.brief}`, '')
  lines.push(formatTranscript(meeting, meeting.utterances) || '_Nothing has been said yet._', '')
  return lines.join('\n')
}

export function meetingDuration(meeting: MeetingState) {
  return meeting.utterances.reduce((max, u) => Math.max(max, u.end), 0)
}

export const isThreadActive = (thread: SideThread) =>
  thread.status === 'queued' || thread.status === 'working'
