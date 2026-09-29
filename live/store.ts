// Meeting state on disk: one directory per meeting with meeting.json (full state) and
// transcript.md (rewritten as people talk, for agents and for the user).
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyEvent, isThreadActive, newMeeting, transcriptMarkdown } from './meeting.ts'
import type { LiveEvent, MeetingState, MeetingSummary } from './types.ts'

const ID = /^[a-f0-9-]{36}$/

function writeAtomic(path: string, content: string) {
  writeFileSync(path + '.tmp', content, { mode: 0o600 })
  renameSync(path + '.tmp', path)
}

export class MeetingStore {
  meeting: MeetingState
  private saveTimer: NodeJS.Timeout | null = null
  private transcriptTimer: NodeJS.Timeout | null = null
  private listeners = new Set<(event: LiveEvent) => void>()
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
    mkdirSync(join(baseDir, 'meetings'), { recursive: true, mode: 0o700 })
    let current: MeetingState | null = null
    try {
      const id = readFileSync(join(baseDir, 'current'), 'utf8').trim()
      if (ID.test(id)) current = this.load(id)
    } catch {
      // First run, or the current meeting was removed.
    }
    this.meeting = current ?? this.create()
    this.writeTranscript()
  }

  subscribe(listener: (event: LiveEvent) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dir(id = this.meeting.id) {
    return join(this.baseDir, 'meetings', id)
  }

  transcriptPath(id = this.meeting.id) {
    return join(this.dir(id), 'transcript.md')
  }

  apply(event: LiveEvent) {
    this.meeting = applyEvent(this.meeting, event)
    for (const listener of this.listeners) listener(event)
    if (event.type === 'partial') return
    this.scheduleSave()
    if (['utterance', 'relabel', 'speaker', 'meeting'].includes(event.type))
      this.transcriptTimer ??= setTimeout(() => {
        this.transcriptTimer = null
        this.writeTranscript()
      }, 400)
  }

  /** Loads a saved meeting, settling anything that was in flight when the server stopped. */
  private load(id: string): MeetingState {
    const meeting = JSON.parse(
      readFileSync(join(this.dir(id), 'meeting.json'), 'utf8')
    ) as MeetingState
    meeting.audio = { state: 'idle' }
    meeting.partials = {}
    meeting.threads = meeting.threads.map(thread =>
      isThreadActive(thread)
        ? {
            ...thread,
            status: 'failed',
            error: 'Threaded Live restarted before this finished. Ask again to continue.',
            activity: thread.activity.map(a =>
              a.status === 'running' ? { ...a, status: 'failed' as const } : a
            ),
          }
        : thread
    )
    return meeting
  }

  private create() {
    const meeting = newMeeting(randomUUID())
    mkdirSync(this.dir(meeting.id), { recursive: true, mode: 0o700 })
    writeAtomic(join(this.baseDir, 'current'), meeting.id)
    this.meeting = meeting
    this.saveNow()
    return meeting
  }

  /** Starts a fresh meeting; the previous one stays on disk. */
  startNew() {
    this.flush()
    this.create()
    this.writeTranscript()
    return this.meeting
  }

  open(id: string) {
    if (!ID.test(id)) throw new Error('Invalid meeting id.')
    this.flush()
    this.meeting = this.load(id)
    writeAtomic(join(this.baseDir, 'current'), id)
    this.writeTranscript()
    return this.meeting
  }

  list(): MeetingSummary[] {
    const summaries: MeetingSummary[] = []
    for (const id of readdirSync(join(this.baseDir, 'meetings'))) {
      if (!ID.test(id)) continue
      try {
        const m =
          id === this.meeting.id
            ? this.meeting
            : (JSON.parse(readFileSync(join(this.dir(id), 'meeting.json'), 'utf8')) as MeetingState)
        summaries.push({
          id: m.id,
          title: m.title,
          createdAt: m.createdAt,
          utterances: m.utterances.length,
          threads: m.threads.length,
        })
      } catch {
        // Skip unreadable meeting directories.
      }
    }
    return summaries.sort((a, b) => b.createdAt - a.createdAt)
  }

  private scheduleSave() {
    this.saveTimer ??= setTimeout(() => {
      this.saveTimer = null
      this.saveNow()
    }, 500)
  }

  private saveNow() {
    const { partials: _partials, ...rest } = this.meeting
    writeAtomic(join(this.dir(), 'meeting.json'), JSON.stringify({ ...rest, partials: {} }))
  }

  private writeTranscript() {
    writeAtomic(this.transcriptPath(), transcriptMarkdown(this.meeting))
  }

  flush() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    if (this.transcriptTimer) clearTimeout(this.transcriptTimer)
    this.saveTimer = this.transcriptTimer = null
    this.saveNow()
    this.writeTranscript()
  }
}
