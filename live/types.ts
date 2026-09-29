// Shared by the live server (Node, type-stripped) and the browser UI. Types only.

/** "me" is the local microphone; "them" is the call app's audio. */
export type Channel = 'me' | 'them'

export interface Speaker {
  id: string
  name: string
  channel: Channel
  /** True once the user has named this speaker; source hints no longer overwrite it. */
  named?: boolean
}

/** A finished stretch of speech, split on natural pauses. Times are seconds from meeting start. */
export interface Utterance {
  id: string
  channel: Channel
  speaker: string
  text: string
  start: number
  end: number
}

/** Words the recognizer has heard but not yet finalized. */
export interface PartialText {
  channel: Channel
  speaker?: string
  text: string
  start: number
}

export type AudioState = 'idle' | 'starting' | 'listening' | 'stopping' | 'error'

export interface AudioStatus {
  state: AudioState
  /** Human-readable source name, e.g. "Replay: demo-call.txt" or "Mac audio". */
  source?: string
  error?: string
  /** Wall-clock ms when the current recording began, for the live clock. */
  startedAt?: number
  /** Meeting-time offset (s) applied to the current recording's timestamps. */
  offset?: number
}

export type ActivityKind =
  | 'read'
  | 'search'
  | 'list'
  | 'command'
  | 'web'
  | 'tool'
  | 'thinking'
  | 'note'

export interface Activity {
  id: string
  /** Which question in the thread this step belongs to (index of the user message). */
  turn: number
  kind: ActivityKind
  label: string
  detail?: string
  status: 'running' | 'done' | 'failed'
}

export interface ThreadMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  at: number
  turn: number
}

export type ThreadStatus = 'queued' | 'working' | 'done' | 'failed' | 'cancelled'

export interface ThreadAnchor {
  quote: string
  utteranceIds: string[]
  start: number
  end: number
  /** How the anchor was chosen: a text selection or the "last 30 seconds" shortcut. */
  via: 'selection' | 'recent'
}

export interface SideThread {
  id: string
  createdAt: number
  updatedAt: number
  anchor: ThreadAnchor | null
  status: ThreadStatus
  messages: ThreadMessage[]
  activity: Activity[]
  error?: string
  executor: string
  /** Executor-side conversation id (e.g. a Codex thread id), used for follow-ups. */
  sessionId?: string
  /** Meeting time (s) the agent has seen transcript up to; follow-ups send what came after. */
  seenUntil: number
}

export interface MeetingState {
  id: string
  title: string
  brief: string
  createdAt: number
  audio: AudioStatus
  speakers: Record<string, Speaker>
  utterances: Utterance[]
  partials: Partial<Record<Channel, PartialText>>
  threads: SideThread[]
}

export interface LiveInfo {
  version: string
  executor: string
  roots: string[]
  transcriptPath: string
  /** Name of the configured transcript source, if any. */
  source: string | null
}

export type LiveEvent =
  | { type: 'snapshot'; meeting: MeetingState; info: LiveInfo }
  | { type: 'meeting'; title?: string; brief?: string }
  | { type: 'audio'; audio: AudioStatus }
  | { type: 'speaker'; speaker: Speaker }
  | { type: 'utterance'; utterance: Utterance }
  | { type: 'relabel'; id: string; speaker: string }
  | { type: 'partial'; channel: Channel; partial: PartialText | null }
  | { type: 'thread'; thread: SideThread }
  | { type: 'thread-text'; threadId: string; messageId: string; delta: string }
  | { type: 'thread-activity'; threadId: string; activity: Activity }

export interface MeetingSummary {
  id: string
  title: string
  createdAt: number
  utterances: number
  threads: number
}
