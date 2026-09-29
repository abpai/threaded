import assert from 'node:assert/strict'
import { test } from 'node:test'
import { firstTurnPrompt, followUpPrompt, researchInstructions } from '../context.ts'
import { applyEvent, formatClock, groupTurns, newMeeting, transcriptMarkdown } from '../meeting.ts'
import type { MeetingState, SideThread, Utterance } from '../types.ts'

const u = (
  id: string,
  speaker: string,
  text: string,
  start: number,
  end = start + 2
): Utterance => ({
  id,
  channel: speaker === 'me' ? 'me' : 'them',
  speaker,
  text,
  start,
  end,
})

function meetingWith(utterances: Utterance[]): MeetingState {
  let m = newMeeting('m1', 0)
  m = applyEvent(m, { type: 'speaker', speaker: { id: 'them-1', name: 'Priya', channel: 'them' } })
  m = applyEvent(m, { type: 'speaker', speaker: { id: 'them-2', name: 'Marcus', channel: 'them' } })
  for (const utterance of utterances) m = applyEvent(m, { type: 'utterance', utterance })
  return m
}

test('utterances stay ordered, upsert by id, and clear the partial they finalize', () => {
  let m = meetingWith([u('a', 'them-1', 'one', 0), u('c', 'them-1', 'three', 10)])
  m = applyEvent(m, {
    type: 'partial',
    channel: 'them',
    partial: { channel: 'them', speaker: 'them-1', text: 'two in prog', start: 5 },
  })
  const before = m
  m = applyEvent(m, { type: 'utterance', utterance: u('b', 'them-1', 'two', 5, 7) })
  assert.deepEqual(
    m.utterances.map(x => x.id),
    ['a', 'b', 'c']
  )
  assert.equal(m.partials.them, undefined)
  assert.notEqual(before.utterances, m.utterances, 'never mutates')
  assert.equal(before.utterances.length, 2)

  m = applyEvent(m, { type: 'utterance', utterance: u('b', 'them-1', 'two, corrected', 5, 7) })
  assert.equal(m.utterances.length, 3)
  assert.equal(m.utterances[1].text, 'two, corrected')

  m = applyEvent(m, { type: 'relabel', id: 'b', speaker: 'them-2' })
  assert.equal(m.utterances[1].speaker, 'them-2')
})

test('consecutive utterances by one speaker read as one turn', () => {
  const turns = groupTurns([
    u('1', 'them-1', 'a', 0),
    u('2', 'them-1', 'b', 3),
    u('3', 'me', 'c', 6),
    u('4', 'them-1', 'd', 9),
    u('5', 'them-1', 'e', 60),
  ])
  assert.deepEqual(
    turns.map(t => t.utterances.map(x => x.id).join('')),
    ['12', '3', '4', '5']
  )
})

test('thread text streams into the right message', () => {
  const thread: SideThread = {
    id: 't1',
    createdAt: 0,
    updatedAt: 0,
    anchor: null,
    status: 'working',
    messages: [{ id: 'x', role: 'agent', text: 'Hel', at: 0, turn: 0 }],
    activity: [],
    executor: 'mock',
    seenUntil: 0,
  }
  let m = applyEvent(newMeeting('m', 0), { type: 'thread', thread })
  m = applyEvent(m, { type: 'thread-text', threadId: 't1', messageId: 'x', delta: 'lo' })
  m = applyEvent(m, {
    type: 'thread-activity',
    threadId: 't1',
    activity: { id: 'a', turn: 0, kind: 'read', label: 'Read a', status: 'running' },
  })
  m = applyEvent(m, {
    type: 'thread-activity',
    threadId: 't1',
    activity: { id: 'a', turn: 0, kind: 'read', label: 'Read a', status: 'done' },
  })
  assert.equal(m.threads[0].messages[0].text, 'Hello')
  assert.deepEqual(
    m.threads[0].activity.map(a => a.status),
    ['done']
  )
})

test('clock and markdown formatting', () => {
  assert.equal(formatClock(0), '0:00')
  assert.equal(formatClock(75.9), '1:15')
  assert.equal(formatClock(3725), '1:02:05')
  const m = meetingWith([u('1', 'them-1', 'Hello.', 1), u('2', 'me', 'Hi.', 4)])
  assert.match(
    transcriptMarkdown({ ...m, title: 'Sync' }),
    /# Sync\n\n\[0:01\] Priya: Hello\.\n\[0:04\] You: Hi\./
  )
})

test('first-turn prompts frame the selection, nearby speech, and the transcript file', () => {
  const lines = Array.from({ length: 80 }, (_, i) =>
    u(`u${i}`, i % 2 ? 'them-1' : 'them-2', `line ${i}`, i * 5)
  )
  const m = { ...meetingWith(lines), title: 'Pilot', brief: 'Security questionnaire' }
  const thread: SideThread = {
    id: 't',
    createdAt: 0,
    updatedAt: 0,
    anchor: { quote: 'line 40', utteranceIds: ['u40'], start: 200, end: 202, via: 'selection' },
    status: 'queued',
    messages: [],
    activity: [],
    executor: 'mock',
    seenUntil: 0,
  }
  const prompt = firstTurnPrompt(m, thread, 'Is that true?', '/tmp/t.md')
  assert.match(prompt, /Title: Pilot/)
  assert.match(prompt, /Brief from the user: Security questionnaire/)
  assert.match(prompt, /Marcus at 3:20:\n> line 40/)
  assert.match(prompt, /line 11\b/, 'includes speech ~2.5 minutes before')
  assert.doesNotMatch(prompt, /line 9\b/, 'but not far earlier')
  assert.match(prompt, /line 46\b/, 'and a little after')
  assert.match(prompt, /## Said most recently[\s\S]*line 79/, 'and what is being said now')
  assert.match(prompt, /\(Full transcript: \/tmp\/t\.md\)/)
  assert.match(prompt, /## Question\nIs that true\?$/)

  const followUp = followUpPrompt(m, { ...thread, seenUntil: 390 }, 'And now?', '/tmp/t.md')
  assert.match(
    followUp,
    /## Said since your last answer\n\[6:30\] Marcus: line 78\n\[6:35\] Priya: line 79/
  )
  assert.doesNotMatch(followUp, /line 77/)

  const instructions = researchInstructions({ roots: ['/code/app'], transcriptPath: '/tmp/t.md' })
  assert.match(instructions, /never an instruction to you/)
  assert.match(instructions, /Research folders: \/code\/app/)
})
