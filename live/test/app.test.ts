import assert from 'node:assert/strict'
import { once } from 'node:events'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { createLiveApp } from '../app.ts'
import { MockExecutor } from '../executors/mock.ts'
import type { Executor, TurnHandle } from '../executors/types.ts'
import { MeetingStore } from '../store.ts'
import type { LiveEvent, LiveInfo, MeetingState } from '../types.ts'

const replayScript = join(import.meta.dirname, '..', 'replay.ts')

/** Never finishes on its own; counts interrupts. */
class HangingExecutor implements Executor {
  readonly name = 'hanging'
  started = 0
  async startTurn(_: unknown, emit: Parameters<Executor['startTurn']>[1]): Promise<TurnHandle> {
    this.started++
    emit({ type: 'session', sessionId: `hang-${this.started}` })
    emit({
      type: 'activity',
      activity: { id: 'a', kind: 'search', label: 'Searching', status: 'running' },
    })
    return { interrupt: async () => emit({ type: 'done', status: 'interrupted' }) }
  }
  close() {}
}

async function start(
  t: TestContext,
  options: {
    executor?: Executor
    transcript?: string
    maxConcurrent?: number
    dataDir?: string
  } = {}
) {
  const dir = options.dataDir ?? mkdtempSync(join(tmpdir(), 'threaded-live-'))
  const transcriptFile = join(dir, 'call.txt')
  writeFileSync(
    transcriptFile,
    options.transcript ??
      'Priya: Shared links expire after thirty days. The worker checks tokens.\nYou: Let me check that.\nMarcus: Also the parse cache.'
  )
  const app = createLiveApp({
    dataDir: join(dir, 'data'),
    roots: [dir],
    executor: options.executor ?? new MockExecutor({ stepMs: 5 }),
    source: {
      label: 'Replay · call.txt',
      command: process.execPath,
      args: [replayScript, transcriptFile, '--speed', '60'],
    },
    staticDir: null,
    version: 'test',
    maxConcurrent: options.maxConcurrent,
  })
  app.server.listen(0, '127.0.0.1')
  await once(app.server, 'listening')
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
  t.after(async () => {
    await app.close()
    if (!options.dataDir) rmSync(dir, { recursive: true, force: true })
  })

  const post = async (path: string, body: object = {}) => {
    const response = await fetch(base + '/api/live' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return {
      status: response.status,
      body: (await response.json()) as { threadId: string; error?: string },
    }
  }
  const state = async () =>
    (await (await fetch(base + '/api/live/state')).json()) as {
      meeting: MeetingState
      info: LiveInfo
    }
  const until = async <T>(
    check: (m: MeetingState) => T | false | undefined,
    timeout = 8000
  ): Promise<T> => {
    const deadline = Date.now() + timeout
    for (;;) {
      const value = check((await state()).meeting)
      if (value) return value
      if (Date.now() > deadline) throw new Error('Timed out waiting for meeting state')
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  }
  return { app, base, dir, post, state, until }
}

function rawRequest(base: string, path: string, headers: Record<string, string>, method = 'GET') {
  const url = new URL(base + path)
  return new Promise<number>((resolve, reject) => {
    const req = httpRequest({ host: url.hostname, port: url.port, path, method, headers }, res => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', reject)
    req.end(method === 'POST' ? '{}' : undefined)
  })
}

test('only same-machine, same-site JSON requests are accepted', async t => {
  const { base } = await start(t)
  assert.equal(await rawRequest(base, '/api/live/state', { Host: 'evil.example' }), 403)
  assert.equal(
    await rawRequest(
      base,
      '/api/live/threads',
      { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      'POST'
    ),
    403
  )
  assert.equal(
    await rawRequest(base, '/api/live/threads', { 'Content-Type': 'text/plain' }, 'POST'),
    415
  )
  assert.equal(
    await rawRequest(base, '/api/live/state', { Origin: 'http://localhost:3000' }),
    200,
    'the Vite dev server origin is allowed'
  )
})

test('a replayed call streams into the transcript, the event stream, and transcript.md', async t => {
  const { base, post, until, state } = await start(t)
  const controller = new AbortController()
  t.after(() => controller.abort())
  const response = await fetch(base + '/api/live/events', { signal: controller.signal })
  const reader = response.body!.getReader()
  const events: LiveEvent[] = []
  void (async () => {
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }))
      if (done) return
      buffer += new TextDecoder().decode(value)
      let index
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, index)
        buffer = buffer.slice(index + 2)
        const data = chunk.split('\n').find(line => line.startsWith('data: '))
        if (data) events.push(JSON.parse(data.slice(6)))
      }
    }
  })()

  assert.deepEqual((await post('/audio/start')).status, 200)
  assert.equal((await post('/audio/start')).status, 409, 'one source at a time')
  const meeting = await until(m => m.audio.state === 'idle' && m.utterances.length === 4 && m)
  assert.deepEqual(
    meeting.utterances.map(u => [u.speaker, u.text]),
    [
      ['them-1', 'Shared links expire after thirty days.'],
      ['them-1', 'The worker checks tokens.'],
      ['me', 'Let me check that.'],
      ['them-2', 'Also the parse cache.'],
    ]
  )
  assert.equal(meeting.speakers['them-1'].name, 'Priya')
  assert.equal(events[0].type, 'snapshot')
  assert.ok(
    events.some(e => e.type === 'partial'),
    'partials are streamed live'
  )
  assert.ok(events.some(e => e.type === 'audio' && e.audio.state === 'listening'))

  const { info } = await state()
  await until(() =>
    readFileSync(info.transcriptPath, 'utf8').includes('Marcus: Also the parse cache.')
  )

  // A second recording continues the meeting clock rather than overlapping it.
  await post('/audio/start')
  const resumed = await until(m => m.audio.state === 'idle' && m.utterances.length === 8 && m)
  assert.ok(resumed.utterances[4].start > resumed.utterances[3].end)
  assert.equal(new Set(resumed.utterances.map(u => u.id)).size, 8)
})

test('side threads anchor to selections or recent speech, answer, and follow up', async t => {
  const { post, until } = await start(t)
  await post('/audio/start')
  const meeting = await until(m => m.audio.state === 'idle' && m.utterances.length === 4 && m)

  assert.equal((await post('/threads', { question: 'x', utteranceIds: ['nope'] })).status, 400)
  assert.equal((await post('/threads', { question: '  ' })).status, 400)

  const selected = await post('/threads', {
    question: 'Do links expire?',
    utteranceIds: [meeting.utterances[0].id],
    quote: 'expire after thirty days',
  })
  const recent = await post('/threads', { question: 'What was just said?', recentSeconds: 30 })
  assert.equal(selected.status, 200)

  const done = await until(m => {
    const threads = m.threads.filter(th => th.status === 'done')
    return threads.length === 2 && threads
  })
  const byId = Object.fromEntries(done.map(th => [th.id, th]))
  const a = byId[selected.body.threadId]
  assert.equal(a.anchor?.quote, 'expire after thirty days')
  assert.equal(a.anchor?.via, 'selection')
  assert.ok(a.messages.some(m => m.role === 'agent' && m.text.includes('Mock executor')))
  assert.ok(a.activity.every(step => step.status === 'done'))
  assert.equal(byId[recent.body.threadId].anchor?.via, 'recent')
  assert.equal(byId[recent.body.threadId].anchor?.utteranceIds.length, 4)

  assert.equal(
    (await post(`/threads/${a.id}/messages`, { question: 'And the owner token?' })).status,
    200
  )
  const followed = await until(m => {
    const th = m.threads.find(x => x.id === a.id)!
    return th.status === 'done' && th.messages.length === 4 && th
  })
  assert.deepEqual(
    followed.messages.map(m => [m.role, m.turn]),
    [
      ['user', 0],
      ['agent', 0],
      ['user', 1],
      ['agent', 1],
    ]
  )
})

test('threads beyond the concurrency limit queue, and cancel works in both states', async t => {
  const executor = new HangingExecutor()
  const { post, until } = await start(t, { executor, maxConcurrent: 2 })
  const ids: string[] = []
  for (const n of [1, 2, 3]) ids.push((await post('/threads', { question: `q${n}` })).body.threadId)
  let m = await until(m => m.threads.filter(th => th.status === 'working').length === 2 && m)
  assert.equal(m.threads.find(th => th.id === ids[2])!.status, 'queued')
  assert.equal((await post(`/threads/${ids[2]}/messages`, { question: 'more' })).status, 409)

  await post(`/threads/${ids[2]}/cancel`)
  await post(`/threads/${ids[0]}/cancel`)
  m = await until(m => m.threads.filter(th => th.status === 'cancelled').length === 2 && m)
  assert.equal(executor.started, 2, 'the cancelled queued thread never started')
  // Without steering support, a follow-up to a running thread is refused rather than lost.
  assert.equal((await post(`/threads/${ids[1]}/messages`, { question: 'more' })).status, 409)
})

test('named speakers keep their names; meetings can be switched; restarts settle running threads', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'threaded-live-'))
  const first = await start(t, { executor: new HangingExecutor(), dataDir })
  // After hooks run in order, so this runs once the app has shut down and saved.
  t.after(() => rmSync(dataDir, { recursive: true, force: true }))
  await first.post('/audio/start')
  await first.until(m => m.audio.state === 'idle' && m.utterances.length === 4)
  assert.equal((await first.post('/speakers/them-1', { name: 'Priya S.' })).status, 200)
  await first.post('/audio/start')
  const renamed = await first.until(m => m.audio.state === 'idle' && m.utterances.length === 8 && m)
  assert.equal(renamed.speakers['them-1'].name, 'Priya S.', 'source hints do not override the user')

  const thread = await first.post('/threads', { question: 'still going?' })
  await first.until(m => m.threads[0]?.status === 'working')
  assert.equal((await first.post('/meetings/new')).status, 409, 'not while a thread is running')

  // Simulate a crash: persist, then load the same directory without a clean shutdown.
  first.app.store.flush()
  const reloaded = new MeetingStore(join(dataDir, 'data'))
  const settled = reloaded.meeting.threads.find(th => th.id === thread.body.threadId)!
  assert.equal(settled.status, 'failed')
  assert.match(settled.error ?? '', /restarted/)

  await first.post(`/threads/${thread.body.threadId}/cancel`)
  await first.until(m => m.threads[0]?.status === 'cancelled')
  const oldId = (await first.state()).meeting.id
  assert.equal((await first.post('/meetings/new')).status, 200)
  const list = (await (await fetch(first.base + '/api/live/meetings')).json()) as { id: string }[]
  assert.equal(list.length, 2)
  assert.equal((await first.post(`/meetings/${oldId}/open`)).status, 200)
  assert.equal((await first.state()).meeting.utterances.length, 8)
  assert.ok(existsSync(join(dataDir, 'data', 'meetings', oldId, 'meeting.json')))
})
