import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { parseSourceLine, type SourceMessage } from './protocol.ts'

export interface SourceHandle {
  /** Asks the source to flush and exit ("stop" on stdin), escalating to signals if it hangs. */
  stop(): Promise<void>
}

export interface SourceOptions {
  command: string
  args: string[]
  cwd?: string
  onMessage(message: SourceMessage): void
  /** Called once, with an error message if the process failed. */
  onExit(error: string | null): void
  stopTimeoutMs?: number
}

export function startSourceProcess(options: SourceOptions): SourceHandle {
  const child = spawn(options.command, options.args, {
    cwd: options.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let finished = false
  let lastStderr = ''
  let protocolError: string | null = null
  const exited = new Promise<void>(resolve => child.once('close', () => resolve()))

  const finish = (error: string | null) => {
    if (finished) return
    finished = true
    options.onExit(error)
  }

  child.on('error', error => finish(`Could not start transcript source: ${error.message}`))
  child.stdin.on('error', () => {})
  child.stderr.on('data', chunk => {
    // Keep the tail for error reporting; diagnostics are also useful in the server log.
    const text = chunk.toString()
    process.stderr.write(`[source] ${text}`)
    lastStderr = (lastStderr + text).slice(-500)
  })
  createInterface({ input: child.stdout }).on('line', line => {
    if (protocolError) return
    try {
      const message = parseSourceLine(line)
      if (message) options.onMessage(message)
    } catch (error) {
      protocolError = error instanceof Error ? error.message : String(error)
      child.kill('SIGTERM')
    }
  })
  child.on('close', (code, signal) => {
    if (protocolError) return finish(protocolError)
    if (code === 0 || signal === 'SIGTERM') return finish(null)
    const tail = lastStderr.trim().split('\n').at(-1)
    finish(`Transcript source exited (${signal ?? `code ${code}`})${tail ? `: ${tail}` : ''}`)
  })

  return {
    async stop() {
      if (finished) return
      child.stdin.write('stop\n')
      const timeout = options.stopTimeoutMs ?? 10_000
      const timer = setTimeout(() => child.kill('SIGTERM'), timeout)
      const hardTimer = setTimeout(() => child.kill('SIGKILL'), timeout + 3000)
      await exited
      clearTimeout(timer)
      clearTimeout(hardTimer)
    },
  }
}
