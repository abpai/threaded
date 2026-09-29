// The transcript-source protocol: newline-delimited JSON written to stdout by a source process
// (the replay script today, the macOS audio helper next). Documented in docs/LIVE.md.
import type { Channel } from '../types.ts'

export type SourceMessage =
  | { type: 'status'; state: 'starting' | 'listening' | 'stopped'; message?: string }
  | { type: 'partial'; channel: Channel; speaker?: string; text: string; start: number }
  | {
      type: 'utterance'
      id: string
      channel: Channel
      speaker?: string
      text: string
      start: number
      end: number
    }
  | { type: 'relabel'; id: string; speaker: string }
  | { type: 'speaker'; id: string; name: string }
  | { type: 'error'; message: string }

const ID = /^[\w:.-]{1,64}$/
const isChannel = (value: unknown): value is Channel => value === 'me' || value === 'them'
const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max

export class ProtocolError extends Error {}

/**
 * Parses one stdout line. Returns null for lines that are not protocol messages (libraries
 * sometimes log to stdout) and throws ProtocolError for malformed protocol messages.
 */
export function parseSourceLine(line: string): SourceMessage | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('{')) return null
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return null
  }
  const fail = (why: string): never => {
    throw new ProtocolError(`Invalid ${String(raw.type)} message from transcript source: ${why}`)
  }
  const speaker = raw.speaker
  if (speaker !== undefined && !(typeof speaker === 'string' && ID.test(speaker)))
    fail('bad speaker id')

  switch (raw.type) {
    case 'status':
      if (raw.state !== 'starting' && raw.state !== 'listening' && raw.state !== 'stopped')
        fail('unknown state')
      return {
        type: 'status',
        state: raw.state as 'starting' | 'listening' | 'stopped',
        message: isText(raw.message, 2000) ? raw.message : undefined,
      }
    case 'partial':
      if (!isChannel(raw.channel) || !isText(raw.text, 20_000) || !isTime(raw.start))
        fail('needs channel, text, start')
      return {
        type: 'partial',
        channel: raw.channel as Channel,
        speaker: speaker as string | undefined,
        text: raw.text as string,
        start: raw.start as number,
      }
    case 'utterance':
      if (
        !(typeof raw.id === 'string' && ID.test(raw.id)) ||
        !isChannel(raw.channel) ||
        !isText(raw.text, 20_000) ||
        !isTime(raw.start) ||
        !isTime(raw.end) ||
        (raw.end as number) < (raw.start as number)
      )
        fail('needs id, channel, text, start <= end')
      return {
        type: 'utterance',
        id: raw.id as string,
        channel: raw.channel as Channel,
        speaker: speaker as string | undefined,
        text: raw.text as string,
        start: raw.start as number,
        end: raw.end as number,
      }
    case 'relabel':
      if (!(typeof raw.id === 'string' && ID.test(raw.id)) || typeof speaker !== 'string')
        fail('needs id and speaker')
      return { type: 'relabel', id: raw.id as string, speaker: speaker as string }
    case 'speaker':
      if (!(typeof raw.id === 'string' && ID.test(raw.id)) || !isText(raw.name, 80))
        fail('needs id and name')
      return { type: 'speaker', id: raw.id as string, name: (raw.name as string).trim() }
    case 'error':
      return {
        type: 'error',
        message: String(raw.message ?? 'Unknown source error').slice(0, 2000),
      }
    default:
      return null
  }
}
