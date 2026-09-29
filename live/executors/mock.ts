// A stand-in executor for UI development and tests. It never reads files; it only mimics the
// shape and timing of a real research turn so the interface can be exercised without Codex.
import type { Executor, ExecutorEvent, TurnHandle, TurnRequest } from './types.ts'

export interface MockOptions {
  /** Milliseconds between simulated steps. */
  stepMs?: number
  /** Makes turns fail, for testing error paths. */
  fail?: boolean
}

let counter = 0

export class MockExecutor implements Executor {
  readonly name = 'mock'
  private options: MockOptions
  constructor(options: MockOptions = {}) {
    this.options = options
  }

  async startTurn(request: TurnRequest, emit: (event: ExecutorEvent) => void): Promise<TurnHandle> {
    const step = this.options.stepMs ?? 450
    const sessionId = request.sessionId ?? `mock-${++counter}`
    if (!request.sessionId) emit({ type: 'session', sessionId })
    const question =
      request.prompt.match(/## (?:Follow-up )?[Qq]uestion\n([\s\S]*)$/)?.[1]?.trim() ?? ''
    const term =
      question
        .split(/\W+/)
        .filter(word => word.length > 4)
        .sort((a, b) => b.length - a.length)[0] ?? 'meeting'
    const messageId = `mock-msg-${++counter}`
    const answer = [
      `**Mock executor:** no files were read. Restart with \`--executor codex\` for real research.`,
      '',
      `- Question received: “${question.slice(0, 140)}”`,
      `- Research folders: ${request.roots.join(', ')}`,
      `- Nothing here is a real finding.`,
    ].join('\n')
    const timers: NodeJS.Timeout[] = []
    let finished = false
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => !finished && fn(), ms))
    const finish = (status: 'completed' | 'interrupted' | 'failed', error?: string) => {
      if (finished) return
      finished = true
      timers.forEach(clearTimeout)
      emit({ type: 'done', status, error })
    }

    const search = {
      id: `${messageId}-search`,
      kind: 'search' as const,
      label: `Searched for “${term}”`,
    }
    at(step, () => emit({ type: 'activity', activity: { ...search, status: 'running' } }))
    at(step * 2, () => emit({ type: 'activity', activity: { ...search, status: 'done' } }))
    at(step * 3, () =>
      emit({
        type: 'activity',
        activity: {
          id: `${messageId}-read`,
          kind: 'read',
          label: 'Read README.md',
          status: 'done',
        },
      })
    )
    if (this.options.fail) {
      at(step * 4, () => finish('failed', 'Mock failure.'))
    } else {
      at(step * 4, () => emit({ type: 'message-start', messageId }))
      const chunks = answer.match(/[\s\S]{1,18}/g) ?? []
      chunks.forEach((delta, i) =>
        at(step * 4 + (i + 1) * 30, () => emit({ type: 'text', messageId, delta }))
      )
      at(step * 4 + (chunks.length + 1) * 30, () => {
        emit({ type: 'message', messageId, text: answer })
        finish('completed')
      })
    }

    return {
      interrupt: async () => finish('interrupted'),
      steer: async text => {
        emit({
          type: 'activity',
          activity: {
            id: `steer-${++counter}`,
            kind: 'note',
            label: `Noted: ${text.slice(0, 80)}`,
            status: 'done',
          },
        })
      },
    }
  }

  close() {}
}
