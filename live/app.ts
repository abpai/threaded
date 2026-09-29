// Threaded Live's local server: one origin serves the UI and a small JSON + SSE API, so the
// browser never needs a pairing token or cross-origin access to localhost.
import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { firstTurnPrompt, followUpPrompt, researchInstructions, steerPrompt } from './context.ts'
import type { Executor, ExecutorEvent, TurnHandle } from './executors/types.ts'
import { isThreadActive, meetingDuration } from './meeting.ts'
import { startSourceProcess, type SourceHandle } from './sources/process.ts'
import type { SourceMessage } from './sources/protocol.ts'
import { MeetingStore } from './store.ts'
import type {
  Channel,
  LiveEvent,
  LiveInfo,
  SideThread,
  ThreadAnchor,
  ThreadStatus,
} from './types.ts'

export interface SourceConfig {
  label: string
  command: string
  args: string[]
}

export interface LiveConfig {
  dataDir: string
  roots: string[]
  executor: Executor
  source: SourceConfig | null
  /** Built SPA to serve; null serves the API only (for the Vite dev server). */
  staticDir: string | null
  version: string
  maxConcurrent?: number
}

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}

interface Run {
  threadId: string
  turn: number
  handle: TurnHandle | null
  finished: boolean
  cancelRequested: boolean
}

export function createLiveApp(config: LiveConfig) {
  const store = new MeetingStore(config.dataDir)
  const maxConcurrent = config.maxConcurrent ?? 6
  const subscribers = new Set<ServerResponse>()
  const runs = new Map<string, Run>()
  const queue: { threadId: string; question: string }[] = []
  let source: { handle: SourceHandle; prefix: string; offset: number } | null = null

  const info = (): LiveInfo => ({
    version: config.version,
    executor: config.executor.name,
    roots: config.roots,
    transcriptPath: store.transcriptPath(),
    source: config.source?.label ?? null,
  })
  const send = (response: ServerResponse, event: LiveEvent) =>
    response.write(`data: ${JSON.stringify(event)}\n\n`)
  const broadcastSnapshot = () => {
    for (const response of subscribers)
      send(response, { type: 'snapshot', meeting: store.meeting, info: info() })
  }
  store.subscribe(event => {
    for (const response of subscribers) send(response, event)
  })

  const apply = (event: LiveEvent) => store.apply(event)
  const findThread = (id: string) => store.meeting.threads.find(t => t.id === id)
  const updateThread = (id: string, patch: Partial<SideThread>) => {
    const thread = findThread(id)
    if (thread) apply({ type: 'thread', thread: { ...thread, ...patch, updatedAt: Date.now() } })
  }

  // ---- Transcript source -------------------------------------------------------------------

  function ensureSpeaker(id: string, channel: Channel) {
    if (store.meeting.speakers[id]) return
    const count = Object.values(store.meeting.speakers).filter(s => s.channel === 'them').length
    apply({ type: 'speaker', speaker: { id, name: `Speaker ${count + 1}`, channel } })
  }

  function speakerFor(channel: Channel, speaker?: string) {
    const id = channel === 'me' ? 'me' : speaker && speaker !== 'me' ? speaker : 'them'
    ensureSpeaker(id, channel)
    return id
  }

  function onSourceMessage(message: SourceMessage) {
    if (!source) return
    const { prefix, offset } = source
    switch (message.type) {
      case 'status':
        if (message.state === 'listening')
          apply({ type: 'audio', audio: { ...store.meeting.audio, state: 'listening' } })
        break
      case 'speaker': {
        const existing = store.meeting.speakers[message.id]
        if (message.id === 'me' || existing?.named || !message.name) break
        apply({
          type: 'speaker',
          speaker: { id: message.id, name: message.name, channel: existing?.channel ?? 'them' },
        })
        break
      }
      case 'partial':
        apply({
          type: 'partial',
          channel: message.channel,
          partial: {
            channel: message.channel,
            speaker: speakerFor(message.channel, message.speaker),
            text: message.text,
            start: message.start + offset,
          },
        })
        break
      case 'utterance':
        if (!message.text.trim()) break
        apply({
          type: 'utterance',
          utterance: {
            id: prefix + message.id,
            channel: message.channel,
            speaker: speakerFor(message.channel, message.speaker),
            text: message.text.trim(),
            start: message.start + offset,
            end: message.end + offset,
          },
        })
        break
      case 'relabel':
        apply({
          type: 'relabel',
          id: prefix + message.id,
          speaker: speakerFor('them', message.speaker),
        })
        break
      case 'error':
        apply({
          type: 'audio',
          audio: { ...store.meeting.audio, state: 'error', error: message.message },
        })
        break
    }
  }

  function startAudio() {
    if (source) throw new HttpError(409, 'Already listening.')
    if (!config.source)
      throw new HttpError(
        400,
        'No transcript source is configured. Restart with --replay <file> or --audio <command>.'
      )
    // A new recording continues the meeting clock after whatever was already said.
    const offset = Math.ceil(
      meetingDuration(store.meeting) + (store.meeting.utterances.length ? 2 : 0)
    )
    const prefix = `${Date.now().toString(36)}-`
    const current = config.source
    apply({
      type: 'audio',
      audio: { state: 'starting', source: current.label, offset, startedAt: Date.now() },
    })
    const handle = startSourceProcess({
      command: current.command,
      args: current.args,
      onMessage: onSourceMessage,
      onExit: error => {
        source = null
        for (const channel of ['me', 'them'] as const)
          if (store.meeting.partials[channel]) apply({ type: 'partial', channel, partial: null })
        const previous = store.meeting.audio
        apply({
          type: 'audio',
          audio:
            error || previous.state === 'error'
              ? { state: 'error', source: current.label, error: error ?? previous.error }
              : { state: 'idle', source: current.label },
        })
      },
    })
    source = { handle, prefix, offset }
  }

  async function stopAudio() {
    if (!source) return
    apply({ type: 'audio', audio: { ...store.meeting.audio, state: 'stopping' } })
    await source.handle.stop()
  }

  // ---- Side threads ------------------------------------------------------------------------

  function anchorFrom(input: Record<string, unknown>): ThreadAnchor | null {
    const utterances = store.meeting.utterances
    if (Array.isArray(input.utteranceIds)) {
      const ids = input.utteranceIds.filter((id): id is string => typeof id === 'string')
      const picked = utterances.filter(u => ids.includes(u.id))
      if (!picked.length) throw new HttpError(400, 'Select words from the transcript.')
      const quote = typeof input.quote === 'string' ? input.quote.trim().slice(0, 4000) : ''
      return {
        quote: quote || picked.map(u => u.text).join(' '),
        utteranceIds: picked.map(u => u.id),
        start: picked[0].start,
        end: picked.at(-1)!.end,
        via: 'selection',
      }
    }
    if (typeof input.recentSeconds === 'number') {
      const now = meetingDuration(store.meeting)
      const since = now - Math.min(Math.max(input.recentSeconds, 5), 300)
      const picked = utterances.filter(u => u.end >= since)
      if (!picked.length) return null
      return {
        quote: picked.map(u => u.text).join(' '),
        utteranceIds: picked.map(u => u.id),
        start: picked[0].start,
        end: picked.at(-1)!.end,
        via: 'recent',
      }
    }
    return null
  }

  function schedule() {
    while (runs.size < maxConcurrent && queue.length) {
      const next = queue.shift()!
      void runTurn(next.threadId, next.question)
    }
  }

  function onExecutorEvent(run: Run, event: ExecutorEvent) {
    if (run.finished) return
    const thread = findThread(run.threadId)
    if (!thread) return
    switch (event.type) {
      case 'session':
        updateThread(thread.id, { sessionId: event.sessionId })
        break
      case 'activity':
        apply({
          type: 'thread-activity',
          threadId: thread.id,
          activity: { ...event.activity, turn: run.turn },
        })
        break
      case 'message-start':
        if (!thread.messages.some(m => m.id === event.messageId))
          updateThread(thread.id, {
            messages: [
              ...thread.messages,
              { id: event.messageId, role: 'agent', text: '', at: Date.now(), turn: run.turn },
            ],
          })
        break
      case 'text':
        apply({
          type: 'thread-text',
          threadId: thread.id,
          messageId: event.messageId,
          delta: event.delta,
        })
        break
      case 'message':
        updateThread(thread.id, {
          messages: event.commentary
            ? thread.messages.filter(m => m.id !== event.messageId)
            : thread.messages.map(m => (m.id === event.messageId ? { ...m, text: event.text } : m)),
        })
        break
      case 'done': {
        run.finished = true
        runs.delete(thread.id)
        const answered = thread.messages.some(
          m => m.role === 'agent' && m.turn === run.turn && m.text
        )
        const status: ThreadStatus =
          event.status === 'completed'
            ? 'done'
            : event.status === 'interrupted'
              ? 'cancelled'
              : 'failed'
        updateThread(thread.id, {
          status,
          error:
            status === 'failed'
              ? (event.error ?? 'The agent failed.')
              : status === 'done' && !answered
                ? 'The agent finished without an answer.'
                : undefined,
          activity: thread.activity.map(a =>
            a.turn === run.turn && a.status === 'running'
              ? { ...a, status: status === 'done' ? 'done' : 'failed' }
              : a
          ),
        })
        schedule()
        break
      }
    }
  }

  async function runTurn(threadId: string, question: string) {
    const thread = findThread(threadId)
    if (!thread || thread.status === 'cancelled') return schedule()
    const turn = thread.messages.filter(m => m.role === 'user').at(-1)?.turn ?? 0
    const run: Run = { threadId, turn, handle: null, finished: false, cancelRequested: false }
    runs.set(threadId, run)
    const transcriptPath = store.transcriptPath()
    const prompt = thread.sessionId
      ? followUpPrompt(store.meeting, thread, question, transcriptPath)
      : firstTurnPrompt(store.meeting, thread, question, transcriptPath)
    updateThread(threadId, {
      status: 'working',
      error: undefined,
      seenUntil: meetingDuration(store.meeting),
    })
    try {
      run.handle = await config.executor.startTurn(
        {
          sessionId: thread.sessionId,
          prompt,
          instructions: researchInstructions({ roots: config.roots, transcriptPath }),
          cwd: config.roots[0],
          roots: config.roots,
        },
        event => onExecutorEvent(run, event)
      )
      if (run.cancelRequested) await cancelRun(run)
    } catch (error) {
      onExecutorEvent(run, {
        type: 'done',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function cancelRun(run: Run) {
    run.cancelRequested = true
    if (!run.handle || run.finished) return
    try {
      await run.handle.interrupt()
    } catch {
      // Fall through to the timeout below.
    }
    // Some turns never acknowledge an interrupt (e.g. a stuck process); settle them anyway.
    setTimeout(() => onExecutorEvent(run, { type: 'done', status: 'interrupted' }), 8000).unref()
  }

  function createThread(input: Record<string, unknown>) {
    const question = typeof input.question === 'string' ? input.question.trim() : ''
    if (!question || question.length > 8000)
      throw new HttpError(400, 'Ask a question (up to 8000 characters).')
    const now = Date.now()
    const thread: SideThread = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      anchor: anchorFrom(input),
      status: 'queued',
      messages: [{ id: randomUUID(), role: 'user', text: question, at: now, turn: 0 }],
      activity: [],
      executor: config.executor.name,
      seenUntil: 0,
    }
    apply({ type: 'thread', thread })
    queue.push({ threadId: thread.id, question })
    schedule()
    return thread
  }

  async function followUp(thread: SideThread, input: Record<string, unknown>) {
    const question = typeof input.question === 'string' ? input.question.trim() : ''
    if (!question || question.length > 8000)
      throw new HttpError(400, 'Ask a question (up to 8000 characters).')
    const run = runs.get(thread.id)
    const lastTurn = thread.messages.at(-1)?.turn ?? 0
    if (thread.status === 'queued') throw new HttpError(409, 'This thread has not started yet.')
    if (run) {
      if (!run.handle?.steer) throw new HttpError(409, 'Wait for this answer before following up.')
      await run.handle.steer(steerPrompt(question))
      updateThread(thread.id, {
        messages: [
          ...thread.messages,
          { id: randomUUID(), role: 'user', text: question, at: Date.now(), turn: run.turn },
        ],
      })
      return
    }
    updateThread(thread.id, {
      status: 'queued',
      error: undefined,
      messages: [
        ...thread.messages,
        { id: randomUUID(), role: 'user', text: question, at: Date.now(), turn: lastTurn + 1 },
      ],
    })
    queue.push({ threadId: thread.id, question })
    schedule()
  }

  async function cancel(thread: SideThread) {
    const index = queue.findIndex(q => q.threadId === thread.id)
    if (index >= 0) {
      queue.splice(index, 1)
      updateThread(thread.id, { status: 'cancelled' })
      return
    }
    const run = runs.get(thread.id)
    if (run) await cancelRun(run)
  }

  // ---- HTTP --------------------------------------------------------------------------------

  function checkRequest(request: IncomingMessage) {
    // Loopback Host blocks DNS rebinding; a foreign Origin means another website is calling.
    const host = (request.headers.host ?? '').replace(/:\d+$/, '')
    if (!LOCAL_HOSTS.has(host)) throw new HttpError(403, 'Threaded Live only answers on localhost.')
    const origin = request.headers.origin
    if (origin) {
      let hostname = ''
      try {
        hostname = new URL(origin).hostname
      } catch {
        // Treated as foreign below.
      }
      if (!LOCAL_HOSTS.has(hostname))
        throw new HttpError(403, 'Cross-site requests are not allowed.')
    }
    if (
      request.method === 'POST' &&
      !request.headers['content-type']?.startsWith('application/json')
    )
      throw new HttpError(415, 'Send JSON.')
  }

  async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of request) {
      size += chunk.length
      if (size > 256_000) throw new HttpError(413, 'Request too large.')
      chunks.push(chunk)
    }
    if (!size) return {}
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (value && typeof value === 'object' && !Array.isArray(value)) return value
    } catch {
      // Reported below.
    }
    throw new HttpError(400, 'Invalid JSON.')
  }

  function openEvents(response: ServerResponse) {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    response.write('retry: 1500\n\n')
    send(response, { type: 'snapshot', meeting: store.meeting, info: info() })
    subscribers.add(response)
    const heartbeat = setInterval(() => response.write(': ping\n\n'), 15_000)
    response.on('close', () => {
      clearInterval(heartbeat)
      subscribers.delete(response)
    })
  }

  async function handleApi(request: IncomingMessage, response: ServerResponse, path: string) {
    checkRequest(request)
    const method = request.method ?? 'GET'
    if (method === 'GET' && path === '/api/live/events') return openEvents(response)

    let result: unknown = { ok: true }
    const threadMatch = path.match(/^\/api\/live\/threads\/([\w-]{1,64})\/(messages|cancel)$/)
    const speakerMatch = path.match(/^\/api\/live\/speakers\/([\w:.-]{1,64})$/)
    const openMatch = path.match(/^\/api\/live\/meetings\/([a-f0-9-]{36})\/open$/)

    if (method === 'GET' && path === '/api/live/state') {
      result = { meeting: store.meeting, info: info() }
    } else if (method === 'GET' && path === '/api/live/meetings') {
      result = store.list()
    } else if (method === 'POST') {
      const input = await readJson(request)
      if (path === '/api/live/audio/start') startAudio()
      else if (path === '/api/live/audio/stop') await stopAudio()
      else if (path === '/api/live/meeting') {
        const title = typeof input.title === 'string' ? input.title.trim().slice(0, 200) : undefined
        const brief =
          typeof input.brief === 'string' ? input.brief.trim().slice(0, 2000) : undefined
        apply({ type: 'meeting', title, brief })
      } else if (speakerMatch) {
        const speaker = store.meeting.speakers[speakerMatch[1]]
        const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : ''
        if (!speaker) throw new HttpError(404, 'Unknown speaker.')
        if (!name) throw new HttpError(400, 'Give the speaker a name.')
        apply({ type: 'speaker', speaker: { ...speaker, name, named: true } })
      } else if (path === '/api/live/threads') {
        result = { threadId: createThread(input).id }
      } else if (threadMatch) {
        const thread = findThread(threadMatch[1])
        if (!thread) throw new HttpError(404, 'Unknown thread.')
        if (threadMatch[2] === 'messages') await followUp(thread, input)
        else await cancel(thread)
      } else if (path === '/api/live/meetings/new' || openMatch) {
        if (source || store.meeting.threads.some(isThreadActive))
          throw new HttpError(409, 'Stop listening and wait for running threads first.')
        if (openMatch) store.open(openMatch[1])
        else store.startNew()
        broadcastSnapshot()
      } else throw new HttpError(404, 'Not found.')
    } else throw new HttpError(404, 'Not found.')

    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(result))
  }

  function serveStatic(request: IncomingMessage, response: ServerResponse, path: string) {
    const host = (request.headers.host ?? '').replace(/:\d+$/, '')
    if (!config.staticDir || !LOCAL_HOSTS.has(host)) throw new HttpError(404, 'Not found.')
    const root = resolve(config.staticDir)
    let decoded: string
    try {
      decoded = decodeURIComponent(path)
    } catch {
      throw new HttpError(404, 'Not found.')
    }
    let file = resolve(join(root, decoded))
    if (file !== root && !file.startsWith(root + sep)) throw new HttpError(404, 'Not found.')
    if (!existsSync(file) || !statSync(file).isFile()) file = join(root, 'index.html')
    const immutable = file.includes(`${sep}assets${sep}`)
    response.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    createReadStream(file).pipe(response)
  }

  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    try {
      if (path.startsWith('/api/live/')) await handleApi(request, response, path)
      else if (request.method === 'GET' || request.method === 'HEAD')
        serveStatic(request, response, path)
      else throw new HttpError(404, 'Not found.')
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      if (status === 500) console.error(error)
      if (!response.headersSent)
        response.writeHead(status, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        })
      response.end(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Server error.' })
      )
    }
  })

  return {
    server,
    store,
    async close() {
      await stopAudio().catch(() => {})
      for (const run of runs.values()) await cancelRun(run).catch(() => {})
      config.executor.close()
      store.flush()
      for (const response of subscribers) response.end()
      server.close()
    },
  }
}
