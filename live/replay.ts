// Replays a transcript file as a live transcript source, speaking the same JSONL protocol as the
// macOS audio helper: partial words at speaking pace, then a final utterance per sentence.
//
//   node live/replay.ts <file> [--speed 2] [--anonymize] [--no-partials]
//
// File format: one speaker block per line, "[mm:ss] Name: text" or "Name: text". Lines starting
// with "#" are comments. "You" or "Me" is treated as the local microphone. JSONL input with
// {speaker, text, start?} objects is also accepted.
import { fstatSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import type { SourceMessage } from './sources/protocol.ts'

export interface Block {
  speaker: string
  text: string
  at?: number
}

const WORDS_PER_SECOND = 2.7

function parseClock(value: string) {
  const parts = value.split(':').map(Number)
  return parts.reduce((total, part) => total * 60 + part, 0)
}

export function parseTranscript(content: string): Block[] {
  const blocks: Block[] = []
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('{')) {
      const item = JSON.parse(line)
      if (typeof item.speaker === 'string' && typeof item.text === 'string')
        blocks.push({
          speaker: item.speaker,
          text: item.text,
          at: typeof item.start === 'number' ? item.start : undefined,
        })
      continue
    }
    const match = line.match(/^(?:\[(\d{1,2}(?::\d{2}){1,2})\]\s*)?([^:[\]]{1,40}):\s+(.+)$/)
    if (match) {
      blocks.push({
        speaker: match[2].trim(),
        text: match[3].trim(),
        at: match[1] ? parseClock(match[1]) : undefined,
      })
    } else if (blocks.length) {
      blocks[blocks.length - 1].text += ' ' + line
    }
  }
  return blocks
}

export interface PlannedMessage {
  at: number
  message: SourceMessage
}

export function planReplay(
  blocks: Block[],
  { anonymize = false, partials = true }: { anonymize?: boolean; partials?: boolean } = {}
): PlannedMessage[] {
  const plan: PlannedMessage[] = []
  const speakers = new Map<string, string>()
  let t = 0.5
  let count = 0
  for (const block of blocks) {
    const key = block.speaker.toLowerCase()
    const isMe = key === 'you' || key === 'me'
    let speaker = isMe ? 'me' : speakers.get(key)
    if (!speaker) {
      speaker = `them-${speakers.size + 1}`
      speakers.set(key, speaker)
      if (!anonymize)
        plan.push({ at: t, message: { type: 'speaker', id: speaker, name: block.speaker } })
    }
    const channel = isMe ? 'me' : 'them'
    if (block.at !== undefined && block.at > t) t = block.at
    const sentences = block.text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [block.text]
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/).filter(Boolean)
      if (!words.length) continue
      const start = t
      if (partials)
        for (let k = 2; k < words.length; k += 2)
          plan.push({
            at: start + k / WORDS_PER_SECOND,
            message: {
              type: 'partial',
              channel,
              speaker,
              text: words.slice(0, k).join(' '),
              start: round(start),
            },
          })
      const end = start + words.length / WORDS_PER_SECOND
      plan.push({
        at: end,
        message: {
          type: 'utterance',
          id: `u${++count}`,
          channel,
          speaker,
          text: words.join(' '),
          start: round(start),
          end: round(end),
        },
      })
      t = end + 0.35
    }
    t += 0.5
  }
  return plan
}

const round = (value: number) => Math.round(value * 100) / 100

async function main(argv: string[]) {
  const file = argv.find(arg => !arg.startsWith('--'))
  if (!file) {
    process.stderr.write('Usage: node live/replay.ts <transcript> [--speed N] [--anonymize]\n')
    process.exit(2)
  }
  const speedIndex = argv.indexOf('--speed')
  const speed = speedIndex >= 0 ? Number(argv[speedIndex + 1]) || 1 : 1
  const plan = planReplay(parseTranscript(readFileSync(file, 'utf8')), {
    anonymize: argv.includes('--anonymize'),
    partials: !argv.includes('--no-partials'),
  })
  const emit = (message: SourceMessage) => process.stdout.write(JSON.stringify(message) + '\n')
  process.stdout.on('error', () => process.exit(0))
  const started = Date.now()
  const pending = new Map<string, Extract<SourceMessage, { type: 'partial' }>>()
  let stopping = false

  const stop = () => {
    if (stopping) return
    stopping = true
    // Like the audio helper, finalize whatever was mid-sentence before exiting.
    for (const partial of pending.values()) {
      const elapsed = (Date.now() - started) / 1000
      emit({
        type: 'utterance',
        id: `u-final-${partial.channel}`,
        channel: partial.channel,
        speaker: partial.speaker,
        text: partial.text,
        start: partial.start,
        end: round(Math.max(partial.start, elapsed * speed)),
      })
    }
    emit({ type: 'status', state: 'stopped' })
    process.exit(0)
  }
  // A closed stdin pipe means the server went away; /dev/null (manual runs) is not a stop request.
  const stdinIsPipe = fstatSync(0).isFIFO() || fstatSync(0).isSocket()
  createInterface({ input: process.stdin })
    .on('line', line => line.trim() === 'stop' && stop())
    .on('close', () => stdinIsPipe && stop())
  process.on('SIGTERM', stop)

  emit({ type: 'status', state: 'starting' })
  await sleep(300)
  emit({ type: 'status', state: 'listening' })
  for (const { at, message } of plan) {
    const wait = (at * 1000) / speed - (Date.now() - started)
    if (wait > 0) await sleep(wait)
    if (stopping) return
    if (message.type === 'partial') pending.set(message.channel, message)
    if (message.type === 'utterance') pending.delete(message.channel)
    emit(message)
  }
  await sleep(500)
  stop()
}

const sleep = (ms: number) => new Promise(done => setTimeout(done, ms))

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main(process.argv.slice(2))
}
