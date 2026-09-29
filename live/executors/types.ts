import type { Activity } from '../types.ts'

/** What every executor reports, whatever agent runtime sits behind it. */
export type ExecutorEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'activity'; activity: Omit<Activity, 'turn'> }
  | { type: 'message-start'; messageId: string }
  | { type: 'text'; messageId: string; delta: string }
  /** Authoritative text once a message completes. `commentary` marks interim narration. */
  | { type: 'message'; messageId: string; text: string; commentary?: boolean }
  | { type: 'done'; status: 'completed' | 'interrupted' | 'failed'; error?: string }

export interface TurnRequest {
  /** Existing executor conversation to continue, if any. */
  sessionId?: string
  prompt: string
  instructions: string
  cwd: string
  roots: string[]
}

export interface TurnHandle {
  interrupt(): Promise<void>
  /** Adds input to the running turn, when the executor supports it. */
  steer?(text: string): Promise<void>
}

export interface Executor {
  readonly name: string
  /** Resolves once the turn is accepted; progress arrives through `emit` until a `done` event. */
  startTurn(request: TurnRequest, emit: (event: ExecutorEvent) => void): Promise<TurnHandle>
  close(): void
}
