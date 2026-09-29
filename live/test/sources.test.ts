import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { parseTranscript, planReplay } from '../replay.ts'
import { parseSourceLine, ProtocolError } from '../sources/protocol.ts'

test('transcript files parse timestamps, speakers, comments, and continuation lines', () => {
  const blocks = parseTranscript(`# comment
[00:05] Priya: First thing.
continued here
You: Second.
{"speaker":"Marcus","text":"From JSON.","start":30}`)
  assert.deepEqual(blocks, [
    { speaker: 'Priya', text: 'First thing. continued here', at: 5 },
    { speaker: 'You', text: 'Second.', at: undefined },
    { speaker: 'Marcus', text: 'From JSON.', at: 30 },
  ])
})

test('replay plans sentences as utterances with partials, speaker hints, and a monotonic clock', () => {
  const plan = planReplay(
    parseTranscript('[0:01] Priya: One two three four. Five six.\nYou: Seven eight nine.')
  )
  const utterances = plan.flatMap(p => (p.message.type === 'utterance' ? [p.message] : []))
  assert.deepEqual(
    utterances.map(x => [x.channel, x.speaker, x.text]),
    [
      ['them', 'them-1', 'One two three four.'],
      ['them', 'them-1', 'Five six.'],
      ['me', 'me', 'Seven eight nine.'],
    ]
  )
  assert.ok(
    utterances.every((x, i) => x.end >= x.start && (i === 0 || x.start >= utterances[i - 1].end))
  )
  assert.deepEqual(plan[0].message, { type: 'speaker', id: 'them-1', name: 'Priya' })
  assert.ok(plan.some(p => p.message.type === 'partial' && p.message.text === 'One two'))
  assert.ok(
    plan.every((p, i) => i === 0 || p.at >= plan[i - 1].at),
    'emitted in time order'
  )

  const anonymous = planReplay(parseTranscript('Priya: Hi.'), { anonymize: true, partials: false })
  assert.equal(anonymous.filter(p => p.message.type === 'speaker').length, 0)
})

test('the demo fixture replays cleanly', () => {
  const file = join(import.meta.dirname, '..', 'fixtures', 'demo-call.txt')
  const plan = planReplay(parseTranscript(readFileSync(file, 'utf8')))
  for (const { message } of plan) assert.ok(parseSourceLine(JSON.stringify(message)), 'round-trips')
  assert.ok(plan.filter(p => p.message.type === 'utterance').length > 40)
})

test('the source protocol ignores stray output and rejects malformed messages', () => {
  assert.equal(parseSourceLine('Loading model weights…'), null)
  assert.equal(parseSourceLine('{"type":"telemetry"}'), null)
  assert.deepEqual(
    parseSourceLine(
      '{"type":"utterance","id":"u1","channel":"them","speaker":"them-2","text":"Hi","start":1,"end":2}'
    ),
    {
      type: 'utterance',
      id: 'u1',
      channel: 'them',
      speaker: 'them-2',
      text: 'Hi',
      start: 1,
      end: 2,
    }
  )
  assert.throws(
    () =>
      parseSourceLine(
        '{"type":"utterance","id":"u1","channel":"them","text":"Hi","start":3,"end":2}'
      ),
    ProtocolError
  )
  assert.throws(
    () => parseSourceLine('{"type":"partial","channel":"room","text":"x","start":0}'),
    ProtocolError
  )
  assert.throws(
    () => parseSourceLine('{"type":"relabel","id":"u1","speaker":"../../etc"}'),
    ProtocolError
  )
})
