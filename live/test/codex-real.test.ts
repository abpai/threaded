// Drives the real Codex CLI (opt-in): THREADED_TEST_CODEX=codex pnpm test:live
// Codex talks to a local fake model, so this needs no login and spends no tokens, but the
// app-server protocol, command execution, and read-only sandbox are all real.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { CodexExecutor } from '../executors/codex.ts'
import type { ExecutorEvent, TurnHandle } from '../executors/types.ts'
import { startFakeResponses } from './fixtures/fake-responses.ts'

const codex = process.env.THREADED_TEST_CODEX

test(
  'real Codex: research, read-only sandbox, and interrupt',
  { skip: !codex && 'set THREADED_TEST_CODEX to a codex binary' },
  async t => {
    const { server, url } = await startFakeResponses()
    const home = mkdtempSync(join(tmpdir(), 'threaded-codex-home-'))
    const project = mkdtempSync(join(tmpdir(), 'threaded-project-'))
    writeFileSync(join(project, 'notes.md'), 'The pilot answer is 4417.\n')
    writeFileSync(
      join(home, 'config.toml'),
      `model = "fake"\nmodel_provider = "fake"\n\n[model_providers.fake]\nname = "Fake"\nbase_url = "${url}"\nwire_api = "responses"\nrequest_max_retries = 0\nstream_max_retries = 0\n`
    )
    const executor = new CodexExecutor({
      command: codex!,
      env: { ...process.env, CODEX_HOME: home, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1' },
    })
    t.after(() => {
      executor.close()
      server.close()
      rmSync(home, { recursive: true, force: true })
      rmSync(project, { recursive: true, force: true })
    })

    const run = (prompt: string, after?: (handle: TurnHandle) => Promise<void>) =>
      new Promise<ExecutorEvent[]>((resolve, reject) => {
        const events: ExecutorEvent[] = []
        executor
          .startTurn({ prompt, instructions: 'Test.', cwd: project, roots: [project] }, event => {
            events.push(event)
            if (event.type === 'done') resolve(events)
          })
          .then(handle => after?.(handle))
          .catch(reject)
      })

    const research = await run('What is the pilot answer?')
    const answer = research.filter(e => e.type === 'message').at(-1)
    assert.ok(answer?.type === 'message' && answer.text.includes('4417'), 'the command really ran')
    assert.ok(
      research.some(
        e => e.type === 'activity' && e.activity.kind === 'read' && e.activity.status === 'done'
      ),
      'cat shows up as a file read'
    )
    assert.deepEqual(research.at(-1), { type: 'done', status: 'completed', error: undefined })

    const write = await run('Please write a file')
    assert.equal(existsSync(join(project, 'written-by-agent.txt')), false, 'sandbox is read-only')
    assert.ok(write.some(e => e.type === 'activity' && e.activity.status === 'failed'))

    const slow = await run('Do something slow', async handle => {
      await new Promise(resolve => setTimeout(resolve, 1500))
      await handle.interrupt()
    })
    assert.deepEqual(slow.at(-1), { type: 'done', status: 'interrupted', error: undefined })
  }
)
