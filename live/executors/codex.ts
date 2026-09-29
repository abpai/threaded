// Executor backed by `codex app-server` (JSON-RPC over stdio, protocol v2). One process serves
// every side thread; each side thread is its own Codex thread, so turns run in parallel.
// Request shapes were checked against codex-cli 0.158 (`codex app-server generate-ts`).
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { Executor, ExecutorEvent, TurnHandle, TurnRequest } from './types.ts'
import type { Activity } from '../types.ts'

type Json = Record<string, unknown>
type Emit = (event: ExecutorEvent) => void

export interface CodexOptions {
  command?: string
  args?: string[]
  env?: NodeJS.ProcessEnv
  /** Optional overrides; by default the user's own Codex config decides. */
  model?: string
  effort?: string
  requestTimeoutMs?: number
  version?: string
}

interface Route {
  emit: Emit
  turnId: string | null
  /** Agent messages by item id; commentary is shown as activity, answers as text. */
  messages: Map<string, { commentary: boolean; text: string; started: boolean }>
  reasoning: Map<string, string>
  lastError: string | null
}

class RpcError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

/** Minimal JSON-RPC peer for the app-server's newline-delimited framing (no "jsonrpc" field). */
class CodexProcess {
  child: ChildProcessWithoutNullStreams
  ready: Promise<void>
  private pending = new Map<
    number,
    { resolve(v: Json): void; reject(e: Error): void; timer: NodeJS.Timeout }
  >()
  private sequence = 0
  private stderrTail = ''
  private exited = false
  private onNotification: (method: string, params: Json) => void
  private onExit: (reason: string) => void

  constructor(
    options: CodexOptions,
    onNotification: (method: string, params: Json) => void,
    onExit: (reason: string) => void
  ) {
    this.onNotification = onNotification
    this.onExit = onExit
    this.child = spawn(options.command ?? 'codex', options.args ?? ['app-server'], {
      env: options.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child.on('error', error => this.fail(`Could not start Codex: ${error.message}`))
    this.child.on('close', (code, signal) =>
      this.fail(
        `Codex app-server exited (${signal ?? `code ${code}`})${
          this.stderrTail ? `: ${this.stderrTail.trim().split('\n').at(-1)}` : ''
        }`
      )
    )
    this.child.stdin.on('error', () => {})
    this.child.stderr.on('data', chunk => {
      const text = chunk.toString()
      if (process.env.THREADED_DEBUG) process.stderr.write(`[codex] ${text}`)
      this.stderrTail = (this.stderrTail + text).slice(-2000)
    })
    createInterface({ input: this.child.stdout }).on('line', line => this.receive(line))

    this.ready = this.request(
      'initialize',
      {
        clientInfo: {
          name: 'threaded_live',
          title: 'Threaded Live',
          version: options.version ?? '0',
        },
      },
      options.requestTimeoutMs
    ).then(() => this.notify('initialized'))
    this.ready.catch(() => {})
  }

  private receive(line: string) {
    let message: Json
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    const id = message.id as number | string | undefined
    const method = message.method as string | undefined
    if (method && id !== undefined) return this.answerServerRequest(id, method)
    if (method) return this.onNotification(method, (message.params ?? {}) as Json)
    const waiter = typeof id === 'number' ? this.pending.get(id) : undefined
    if (!waiter) return
    this.pending.delete(id as number)
    clearTimeout(waiter.timer)
    const error = message.error as { code?: number; message?: string } | undefined
    if (error)
      waiter.reject(new RpcError(error.code ?? -1, error.message ?? 'Codex request failed'))
    else waiter.resolve((message.result ?? {}) as Json)
  }

  /** Side threads are read-only research: every approval or input request is declined. */
  private answerServerRequest(id: number | string, method: string) {
    let result: Json | null = null
    if (method === 'item/commandExecution/requestApproval') result = { decision: 'decline' }
    else if (method === 'item/fileChange/requestApproval') result = { decision: 'decline' }
    else if (method === 'mcpServer/elicitation/request')
      result = { action: 'decline', content: null, _meta: null }
    else if (method === 'item/tool/requestUserInput') result = { answers: {} }
    if (result) this.write({ id, result })
    else
      this.write({
        id,
        error: { code: -32601, message: `Threaded Live does not handle ${method}.` },
      })
  }

  private write(message: Json) {
    if (!this.exited) this.child.stdin.write(JSON.stringify(message) + '\n')
  }

  notify(method: string, params?: Json) {
    this.write(params ? { method, params } : { method })
  }

  request(method: string, params: Json, timeoutMs = 60_000): Promise<Json> {
    if (this.exited) return Promise.reject(new Error('Codex is not running.'))
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex did not answer ${method} within ${Math.round(timeoutMs / 1000)}s.`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.write({ id, method, params })
    })
  }

  private fail(reason: string) {
    if (this.exited) return
    this.exited = true
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timer)
      waiter.reject(new Error(reason))
    }
    this.pending.clear()
    this.onExit(reason)
  }

  close() {
    this.child.kill('SIGTERM')
  }
}

const clip = (text: string, max = 120) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat
}
const baseName = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path

/** Codex reports commands wrapped in a login shell; show what actually ran. */
export function unwrapShell(command: string) {
  const match = command.match(/^(?:\S*\/)?(?:ba|z)?sh -l?c (['"])([\s\S]*)\1$/)
  return match ? match[2].replace(/\\(["\\$`])/g, '$1') : command
}

function statusOf(value: unknown): Activity['status'] {
  if (value === 'inProgress') return 'running'
  if (value === 'completed') return 'done'
  return 'failed'
}

/** Turns a Codex thread item into a one-line activity entry, or null if it is not activity. */
export function describeItem(item: Json): Omit<Activity, 'turn'> | null {
  const id = String(item.id)
  switch (item.type) {
    case 'commandExecution': {
      const actions = (item.commandActions ?? []) as Json[]
      const command = unwrapShell(String(item.command ?? ''))
      const status = statusOf(item.status)
      const reads = actions.filter(a => a.type === 'read')
      const search = actions.find(a => a.type === 'search')
      const list = actions.find(a => a.type === 'listFiles')
      if (reads.length)
        return {
          id,
          kind: 'read',
          label: `Read ${reads.map(a => String(a.name || baseName(String(a.path)))).join(', ')}`,
          detail: reads.map(a => String(a.path)).join('\n'),
          status,
        }
      if (search)
        return {
          id,
          kind: 'search',
          label: `Searched ${search.query ? `for “${clip(String(search.query), 60)}”` : 'files'}${
            search.path ? ` in ${search.path}` : ''
          }`,
          detail: command,
          status,
        }
      if (list)
        return {
          id,
          kind: 'list',
          label: `Listed ${list.path ?? 'files'}`,
          detail: command,
          status,
        }
      return { id, kind: 'command', label: `Ran ${clip(command, 80)}`, detail: command, status }
    }
    case 'webSearch': {
      const action = item.action as Json | null
      const label =
        action?.type === 'openPage' && action.url
          ? `Opened ${clip(String(action.url), 80)}`
          : `Searched the web for “${clip(String(item.query || action?.query || ''), 60)}”`
      return { id, kind: 'web', label, status: 'done' }
    }
    case 'mcpToolCall':
      return {
        id,
        kind: 'tool',
        label: `Used ${item.server} · ${item.tool}`,
        status: statusOf(item.status),
        detail: item.error ? String((item.error as Json).message ?? '') : undefined,
      }
    case 'dynamicToolCall':
      return { id, kind: 'tool', label: `Used ${item.tool}`, status: statusOf(item.status) }
    case 'fileChange':
      return {
        id,
        kind: 'note',
        label: 'Tried to edit files (blocked: read-only)',
        status: 'failed',
      }
    case 'plan':
      return {
        id,
        kind: 'note',
        label: clip(String(item.text ?? 'Planned next steps')),
        status: 'done',
      }
    default:
      return null
  }
}

export class CodexExecutor implements Executor {
  readonly name = 'codex'
  private process: CodexProcess | null = null
  private loaded = new Set<string>()
  private routes = new Map<string, Route>()
  private options: CodexOptions

  constructor(options: CodexOptions = {}) {
    this.options = options
  }

  private async connect() {
    if (!this.process) {
      const spawned: CodexProcess = new CodexProcess(
        this.options,
        (method, params) => this.onNotification(method, params),
        reason => {
          // A replaced process can exit after its successor started; leave the successor alone.
          if (this.process !== spawned) return
          this.process = null
          this.loaded.clear()
          for (const route of this.routes.values())
            route.emit({ type: 'done', status: 'failed', error: reason })
          this.routes.clear()
        }
      )
      this.process = spawned
    }
    const current = this.process
    try {
      await current.ready
    } catch (error) {
      // A process that never finished its handshake is not reused; the next turn starts fresh.
      if (this.process === current) {
        current.close()
        this.process = null
      }
      throw error
    }
    return current
  }

  async startTurn(request: TurnRequest, emit: Emit): Promise<TurnHandle> {
    const rpc = await this.connect()
    const threadSettings = {
      cwd: request.cwd,
      sandbox: 'read-only',
      approvalPolicy: 'never',
      developerInstructions: request.instructions,
      ...(this.options.model ? { model: this.options.model } : {}),
    }
    let threadId = request.sessionId
    if (!threadId) {
      const started = await rpc.request('thread/start', threadSettings)
      threadId = String((started.thread as Json).id)
      emit({ type: 'session', sessionId: threadId })
    } else if (!this.loaded.has(threadId)) {
      await rpc.request('thread/resume', { threadId, ...threadSettings })
    }
    this.loaded.add(threadId)

    const route: Route = {
      emit,
      turnId: null,
      messages: new Map(),
      reasoning: new Map(),
      lastError: null,
    }
    // Registered before turn/start: notifications can arrive before its response.
    this.routes.set(threadId, route)
    const id = threadId
    try {
      const result = await rpc.request('turn/start', {
        threadId: id,
        input: [{ type: 'text', text: request.prompt, text_elements: [] }],
        ...(this.options.effort ? { effort: this.options.effort } : {}),
      })
      route.turnId = String((result.turn as Json).id)
    } catch (error) {
      this.routes.delete(id)
      throw error
    }

    return {
      interrupt: async () => {
        if (!route.turnId || this.routes.get(id) !== route) return
        await rpc.request('turn/interrupt', { threadId: id, turnId: route.turnId })
      },
      // turn/start on a thread with an active turn steers that turn instead of starting another.
      steer: async (text: string) => {
        await rpc.request('turn/start', {
          threadId: id,
          input: [{ type: 'text', text, text_elements: [] }],
        })
      },
    }
  }

  private onNotification(method: string, params: Json) {
    const threadId = params.threadId as string | undefined
    const route = threadId ? this.routes.get(threadId) : undefined
    if (!route || !threadId) return
    const { emit } = route

    switch (method) {
      case 'turn/started':
        route.turnId = String((params.turn as Json).id)
        break
      case 'item/started':
      case 'item/completed': {
        const item = params.item as Json
        const completed = method === 'item/completed'
        if (item.type === 'agentMessage') return this.onAgentMessage(route, item, completed)
        if (item.type === 'reasoning') {
          const summary = ((item.summary ?? []) as string[]).join('\n').trim()
          const text = summary || route.reasoning.get(String(item.id)) || ''
          if (completed && text)
            emit({
              type: 'activity',
              activity: {
                id: String(item.id),
                kind: 'thinking',
                label: clip(lastParagraph(text)),
                status: 'done',
              },
            })
          return
        }
        const activity = describeItem(item)
        if (activity) emit({ type: 'activity', activity })
        break
      }
      case 'item/agentMessage/delta': {
        const itemId = String(params.itemId)
        const message = route.messages.get(itemId) ?? {
          commentary: false,
          text: '',
          started: false,
        }
        route.messages.set(itemId, message)
        message.text += String(params.delta ?? '')
        if (message.commentary)
          emit({
            type: 'activity',
            activity: { id: itemId, kind: 'note', label: clip(message.text), status: 'running' },
          })
        else {
          if (!message.started) {
            message.started = true
            emit({ type: 'message-start', messageId: itemId })
          }
          emit({ type: 'text', messageId: itemId, delta: String(params.delta ?? '') })
        }
        break
      }
      case 'item/reasoning/summaryTextDelta': {
        const itemId = String(params.itemId)
        const text = (route.reasoning.get(itemId) ?? '') + String(params.delta ?? '')
        route.reasoning.set(itemId, text)
        emit({
          type: 'activity',
          activity: {
            id: itemId,
            kind: 'thinking',
            label: clip(lastParagraph(text)),
            status: 'running',
          },
        })
        break
      }
      case 'error': {
        const error = params.error as Json | undefined
        const message = String(error?.message ?? 'Codex reported an error.')
        if (params.willRetry)
          emit({
            type: 'activity',
            activity: {
              id: `retry-${params.turnId}`,
              kind: 'note',
              label: message,
              status: 'running',
            },
          })
        else route.lastError = message
        break
      }
      case 'turn/completed': {
        const turn = params.turn as Json
        if (route.turnId && turn.id !== route.turnId) return
        const status =
          turn.status === 'completed'
            ? 'completed'
            : turn.status === 'interrupted'
              ? 'interrupted'
              : 'failed'
        const turnError = turn.error as Json | null
        emit({
          type: 'done',
          status,
          error:
            status === 'failed'
              ? String(turnError?.message ?? route.lastError ?? 'Codex could not finish this turn.')
              : undefined,
        })
        this.routes.delete(threadId)
        break
      }
    }
  }

  private onAgentMessage(route: Route, item: Json, completed: boolean) {
    const itemId = String(item.id)
    const known = route.messages.get(itemId)
    const commentary = item.phase === 'commentary' || (known?.commentary ?? false)
    const message = known ?? { commentary, text: '', started: false }
    message.commentary = commentary
    route.messages.set(itemId, message)
    if (!completed) {
      if (!commentary && !message.started) {
        message.started = true
        route.emit({ type: 'message-start', messageId: itemId })
      }
      return
    }
    const text = String(item.text ?? message.text)
    if (commentary) {
      route.emit({
        type: 'activity',
        activity: { id: itemId, kind: 'note', label: clip(text), status: 'done' },
      })
      // A message streamed as an answer that turns out to be commentary is withdrawn.
      if (message.started)
        route.emit({ type: 'message', messageId: itemId, text, commentary: true })
    } else {
      if (!message.started) {
        message.started = true
        route.emit({ type: 'message-start', messageId: itemId })
      }
      route.emit({ type: 'message', messageId: itemId, text })
    }
  }

  close() {
    this.process?.close()
    this.process = null
  }
}

function lastParagraph(text: string) {
  const parts = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
  return (parts.at(-1) ?? text).replace(/^\*\*(.+?)\*\*\s*/, '$1: ')
}
