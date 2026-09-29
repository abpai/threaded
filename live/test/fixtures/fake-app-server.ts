// A scripted stand-in for `codex app-server`, replaying the message shapes observed from
// codex-cli 0.158. The prompt text picks a scenario: "crash", "hang", "fail", or a normal turn.
import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

type Json = Record<string, unknown>
const out = (message: Json) => process.stdout.write(JSON.stringify(message) + '\n')
// What the client sent, for assertions: JSON lines appended to $FAKE_CODEX_LOG.
const log = (entry: Json) =>
  process.env.FAKE_CODEX_LOG &&
  appendFileSync(process.env.FAKE_CODEX_LOG, JSON.stringify(entry) + '\n')
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
let seq = 0
const id = (prefix: string) => `${prefix}-${++seq}`
const serverRequests = new Map<string, (result: Json) => void>()
const hanging = new Map<string, string>()

async function runTurn(threadId: string, turnId: string, text: string) {
  const base = { threadId, turnId }
  out({ method: 'turn/started', params: { threadId, turn: { id: turnId, status: 'inProgress' } } })
  if (text.includes('crash')) {
    await wait(20)
    process.exit(3)
  }
  if (text.includes('hang')) return void hanging.set(threadId, turnId)
  if (text.includes('fail')) {
    out({
      method: 'error',
      params: { ...base, willRetry: true, error: { message: 'Reconnecting... 1/5' } },
    })
    out({
      method: 'error',
      params: { ...base, willRetry: false, error: { message: 'Model unavailable' } },
    })
    out({
      method: 'turn/completed',
      params: {
        threadId,
        turn: { id: turnId, status: 'failed', error: { message: 'Model unavailable' } },
      },
    })
    return
  }

  const commentary = id('msg')
  out({
    method: 'item/started',
    params: {
      ...base,
      item: { type: 'agentMessage', id: commentary, text: '', phase: 'commentary' },
    },
  })
  out({
    method: 'item/agentMessage/delta',
    params: { ...base, itemId: commentary, delta: 'Looking in ' },
  })
  out({
    method: 'item/agentMessage/delta',
    params: { ...base, itemId: commentary, delta: 'the worker.' },
  })
  out({
    method: 'item/completed',
    params: {
      ...base,
      item: {
        type: 'agentMessage',
        id: commentary,
        text: 'Looking in the worker.',
        phase: 'commentary',
      },
    },
  })

  // A read-only turn should never be granted anything; the client must decline.
  const approval = id('req')
  const decision = new Promise<Json>(resolve => serverRequests.set(approval, resolve))
  out({
    id: approval,
    method: 'item/commandExecution/requestApproval',
    params: { ...base, itemId: 'x', command: 'rm -rf /' },
  })
  const answer = await decision
  log({ type: 'approvalAnswer', threadId, answer })

  const command = {
    type: 'commandExecution',
    id: id('call'),
    command: `/bin/bash -lc "rg -n 'nanoid' worker"`,
    cwd: '/repo',
    status: 'inProgress',
    commandActions: [
      { type: 'search', command: "rg -n 'nanoid' worker", query: 'nanoid', path: 'worker' },
    ],
  }
  out({ method: 'item/started', params: { ...base, item: command } })
  await wait(10)
  out({
    method: 'item/completed',
    params: { ...base, item: { ...command, status: 'completed', exitCode: 0 } },
  })
  const read = {
    type: 'commandExecution',
    id: id('call'),
    command: 'sed -n 1,40p worker/routes/sessions.ts',
    status: 'completed',
    commandActions: [
      {
        type: 'read',
        command: 'sed',
        name: 'sessions.ts',
        path: '/repo/worker/routes/sessions.ts',
      },
    ],
  }
  out({ method: 'item/completed', params: { ...base, item: read } })

  const reasoning = id('rs')
  out({
    method: 'item/reasoning/summaryTextDelta',
    params: {
      ...base,
      itemId: reasoning,
      delta: '**Checking**\n\nIDs use nanoid.',
      summaryIndex: 0,
    },
  })
  out({
    method: 'item/completed',
    params: {
      ...base,
      item: {
        type: 'reasoning',
        id: reasoning,
        summary: ['**Checking**\n\nIDs use nanoid.'],
        content: [],
      },
    },
  })

  const answerId = id('msg')
  out({
    method: 'item/started',
    params: {
      ...base,
      item: { type: 'agentMessage', id: answerId, text: '', phase: 'final_answer' },
    },
  })
  for (const delta of ['Session IDs are ', '21-character nanoids.'])
    out({ method: 'item/agentMessage/delta', params: { ...base, itemId: answerId, delta } })
  out({
    method: 'item/completed',
    params: {
      ...base,
      item: {
        type: 'agentMessage',
        id: answerId,
        text: 'Session IDs are 21-character nanoids.',
        phase: 'final_answer',
      },
    },
  })
  out({
    method: 'turn/completed',
    params: { threadId, turn: { id: turnId, status: 'completed', error: null } },
  })
}

createInterface({ input: process.stdin }).on('line', line => {
  const message = JSON.parse(line) as Json
  const params = (message.params ?? {}) as Json
  if (message.method === undefined && message.id !== undefined) {
    serverRequests.get(String(message.id))?.((message.result ?? { error: message.error }) as Json)
    return
  }
  switch (message.method) {
    case 'initialize':
      return out({ id: message.id, result: { userAgent: 'fake' } })
    case 'initialized':
      return
    case 'thread/start': {
      const threadId = id('thread')
      log({ type: 'threadStart', threadId, params })
      return out({
        id: message.id,
        result: { thread: { id: threadId }, sandbox: { type: 'readOnly' } },
      })
    }
    case 'thread/resume':
      log({ type: 'threadResume', params })
      return out({ id: message.id, result: { thread: { id: params.threadId } } })
    case 'turn/start': {
      const threadId = String(params.threadId)
      const text = String(((params.input as Json[])[0] as Json).text)
      if (hanging.has(threadId)) {
        log({ type: 'steer', threadId, text })
        return out({
          id: message.id,
          result: { turn: { id: hanging.get(threadId), status: 'inProgress' } },
        })
      }
      const turnId = id('turn')
      out({ id: message.id, result: { turn: { id: turnId, status: 'inProgress' } } })
      return void runTurn(threadId, turnId, text)
    }
    case 'turn/interrupt': {
      const threadId = String(params.threadId)
      out({ id: message.id, result: {} })
      if (hanging.get(threadId) === params.turnId) {
        hanging.delete(threadId)
        out({
          method: 'turn/completed',
          params: { threadId, turn: { id: params.turnId, status: 'interrupted' } },
        })
      }
      return
    }
    default:
      return out({ id: message.id, error: { code: -32601, message: `unknown ${message.method}` } })
  }
})
