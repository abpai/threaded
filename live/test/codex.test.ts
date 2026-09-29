import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { CodexExecutor, describeItem, unwrapShell } from '../executors/codex.ts'
import type { ExecutorEvent, TurnHandle } from '../executors/types.ts'

const fixture = join(import.meta.dirname, 'fixtures', 'fake-app-server.ts')

function setup(t: import('node:test').TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'threaded-codex-'))
  const logPath = join(dir, 'log.jsonl')
  const executor = new CodexExecutor({
    command: process.execPath,
    args: [fixture],
    env: { ...process.env, FAKE_CODEX_LOG: logPath },
  })
  t.after(() => {
    executor.close()
    rmSync(dir, { recursive: true, force: true })
  })
  const log = () =>
    readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
  return { executor, log }
}

function turn(
  executor: CodexExecutor,
  prompt: string,
  sessionId?: string
): { events: ExecutorEvent[]; handle: Promise<TurnHandle>; done: Promise<ExecutorEvent> } {
  const events: ExecutorEvent[] = []
  let resolveDone!: (event: ExecutorEvent) => void
  const done = new Promise<ExecutorEvent>(resolve => (resolveDone = resolve))
  const handle = executor.startTurn(
    { prompt, instructions: 'Answer briefly.', cwd: '/repo', roots: ['/repo'], sessionId },
    event => {
      events.push(event)
      if (event.type === 'done') resolveDone(event)
    }
  )
  return { events, handle, done }
}

test('a research turn maps Codex items to activity, commentary, and a streamed answer', async t => {
  const { executor, log } = setup(t)
  const { events, handle, done } = turn(executor, 'Where are session ids made?')
  await handle
  assert.deepEqual(await done, { type: 'done', status: 'completed', error: undefined })

  const session = events.find(e => e.type === 'session')
  assert.ok(session && session.type === 'session')

  const activity = events.flatMap(e => (e.type === 'activity' ? [e.activity] : []))
  const final = (id: string) => activity.filter(a => a.id === id).at(-1)
  const labels = [...new Set(activity.map(a => a.id))].map(id => final(id)!)
  assert.deepEqual(
    labels.map(a => [a.kind, a.label, a.status]),
    [
      ['note', 'Looking in the worker.', 'done'],
      ['search', 'Searched for “nanoid” in worker', 'done'],
      ['read', 'Read sessions.ts', 'done'],
      ['thinking', 'IDs use nanoid.', 'done'],
    ]
  )

  // Commentary never reaches the answer; the final answer streams and then settles.
  const text = events.flatMap(e => (e.type === 'text' ? [e.delta] : [])).join('')
  assert.equal(text, 'Session IDs are 21-character nanoids.')
  const message = events.find(e => e.type === 'message')
  assert.equal(message?.type === 'message' && message.text, 'Session IDs are 21-character nanoids.')

  const entries = log()
  const start = entries.find(e => e.type === 'threadStart')
  assert.equal(start.params.sandbox, 'read-only')
  assert.equal(start.params.approvalPolicy, 'never')
  assert.equal(start.params.developerInstructions, 'Answer briefly.')
  assert.deepEqual(entries.find(e => e.type === 'approvalAnswer').answer, { decision: 'decline' })
})

test('follow-ups resume the same Codex thread once per process', async t => {
  const { executor, log } = setup(t)
  const first = turn(executor, 'first')
  await first.done
  const session = first.events.find(e => e.type === 'session')
  const sessionId = session?.type === 'session' ? session.sessionId : ''
  const second = turn(executor, 'second', sessionId)
  assert.equal((await second.done).type, 'done')
  assert.equal(second.events.filter(e => e.type === 'session').length, 0)
  // Loaded in this process already, so no resume is needed.
  assert.equal(log().filter(e => e.type === 'threadResume').length, 0)

  const fresh = new CodexExecutor({
    command: process.execPath,
    args: [fixture],
    env: { ...process.env, FAKE_CODEX_LOG: join(tmpdir(), `threaded-resume-${process.pid}.jsonl`) },
  })
  t.after(() => fresh.close())
  const resumed = turn(fresh, 'third', sessionId)
  assert.equal(((await resumed.done) as { status: string }).status, 'completed')
})

test('turns on different threads run concurrently', async t => {
  const { executor } = setup(t)
  const turns = [1, 2, 3, 4, 5].map(n => turn(executor, `question ${n}`))
  const results = await Promise.all(turns.map(t => t.done))
  assert.ok(results.every(r => r.type === 'done' && r.status === 'completed'))
  const sessions = new Set(
    turns
      .map(t => t.events.find(e => e.type === 'session'))
      .map(e => e?.type === 'session' && e.sessionId)
  )
  assert.equal(sessions.size, 5)
})

test('steer adds to a running turn and interrupt stops it', async t => {
  const { executor, log } = setup(t)
  const { handle, done } = turn(executor, 'hang please')
  const h = await handle
  await h.steer!('also check staging')
  await h.interrupt()
  assert.deepEqual(await done, { type: 'done', status: 'interrupted', error: undefined })
  assert.equal(log().find(e => e.type === 'steer').text, 'also check staging')
})

test('a failed turn reports the model error', async t => {
  const { executor } = setup(t)
  const { events, done } = turn(executor, 'fail now')
  assert.deepEqual(await done, { type: 'done', status: 'failed', error: 'Model unavailable' })
  assert.ok(
    events.some(e => e.type === 'activity' && e.activity.label === 'Reconnecting... 1/5'),
    'retries show as activity'
  )
})

test('a crashed app-server fails running turns and restarts on the next question', async t => {
  const { executor } = setup(t)
  const crashed = turn(executor, 'crash')
  const result = await crashed.done
  assert.equal(result.type === 'done' && result.status, 'failed')
  assert.match((result as { error: string }).error, /exited/)
  const next = turn(executor, 'next question')
  assert.equal(((await next.done) as { status: string }).status, 'completed')
})

test('a missing codex binary rejects the turn instead of hanging', async () => {
  const executor = new CodexExecutor({ command: '/nonexistent/codex' })
  await assert.rejects(
    executor.startTurn({ prompt: 'x', instructions: '', cwd: '/', roots: ['/'] }, () => {}),
    /Could not start Codex/
  )
})

test('an app-server that never finishes its handshake is replaced, not reused', async () => {
  const executor = new CodexExecutor({
    command: process.execPath,
    args: ['-e', 'setInterval(() => {}, 1000)'],
    requestTimeoutMs: 150,
  })
  const request = { prompt: 'x', instructions: '', cwd: '/', roots: ['/'] }
  await assert.rejects(
    executor.startTurn(request, () => {}),
    /did not answer initialize/
  )
  await assert.rejects(
    executor.startTurn(request, () => {}),
    /did not answer initialize/
  )
  executor.close()
})

test('shell wrappers are unwrapped and file edits are flagged in activity labels', () => {
  assert.equal(unwrapShell(`/bin/bash -lc 'touch /tmp/x && echo ok'`), 'touch /tmp/x && echo ok')
  assert.equal(unwrapShell(`/bin/zsh -lc "rg -n \\"a b\\" src"`), 'rg -n "a b" src')
  assert.equal(unwrapShell('rg foo'), 'rg foo')
  assert.equal(
    describeItem({
      type: 'commandExecution',
      id: '1',
      command: 'ls',
      status: 'failed',
      commandActions: [],
    })?.status,
    'failed'
  )
  assert.equal(
    describeItem({ type: 'fileChange', id: '2', changes: [], status: 'failed' })?.label,
    'Tried to edit files (blocked: read-only)'
  )
  assert.equal(describeItem({ type: 'contextCompaction', id: '3' }), null)
})
