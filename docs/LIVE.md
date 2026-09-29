# Threaded Live

A live transcript of a call, where you can select anything anyone said and branch off a **side thread**. Each side thread is its own agent running on your machine (Codex today), with read-only access to the folders you choose and the conversation so far. Ask several questions at once; the call keeps going while they research.

**Status: development preview.** The transcript pipeline, side threads, Codex integration, and UI work end to end with a replayed call. Live audio capture on macOS is the next phase ([spec below](#phase-2-macos-audio-helper)).

## Quick start

Requirements: Node 22.18+ (the server runs on Node's built-in TypeScript support), pnpm, and the [Codex CLI](https://developers.openai.com/codex) signed in (`codex login`).

```bash
pnpm install
pnpm live --replay live/fixtures/demo-call.txt --root .
```

This builds the web app on first run, starts a server on `http://localhost:4319`, and opens `/live`. Press **Start listening** to replay a short call about this repository, then select something someone said:

- **Explain** or **Fact-check** start a side thread immediately.
- **Ask** lets you type your own question.
- **⌘K / Ctrl K** asks about the last 30 seconds without selecting anything.

Side threads show what the agent is doing as it works (files read, searches, commands), then a short answer with `path:line` citations. Follow-ups continue the same agent conversation, and messages sent while a thread is working are added to that turn. Click a speaker's name to rename them. The name is used in the transcript and in what the agents see.

Without Codex installed, the server falls back to a mock executor that only simulates research (`--executor mock`).

### Options

```text
--replay <file>     Replay a transcript file as if it were live ("[mm:ss] Name: text" lines)
--speed <n>         Replay speed multiplier
--audio <command>   Run an audio helper that speaks the source protocol (below)
--root <dir>        Folder the agent researches (repeatable; default: current directory)
--executor <name>   codex (default) or mock
--codex <path>      Codex binary; --model and --effort override your Codex config
--port <n>          Default 4319, bound to 127.0.0.1 only
--data <dir>        Where meetings are kept (default ~/.threaded/live)
--no-open, --dev    Skip opening the browser; --dev serves the API only
```

For UI development, run `pnpm live:api --replay live/fixtures/demo-call.txt` and `pnpm dev` side by side, then open `http://localhost:3000/live`. Vite proxies `/api/live` to the live server.

## How it works

```text
 audio helper / replay ──JSONL──▶ live server (Node, 127.0.0.1) ──SSE──▶ browser (/live)
                                   │  meeting store + transcript.md
                                   │
                                   └─JSON-RPC─▶ codex app-server ──▶ one Codex thread per side thread
```

- **One origin.** The server serves the UI and API together on localhost, so there is no pairing token and no cross-origin access to localhost. It answers only for loopback `Host` headers (which blocks DNS rebinding), rejects requests with a foreign `Origin`, and accepts only JSON posts.
- **Transcript model.** Sources send _utterances_ split on natural pauses, not fixed-length chunks. The UI merges consecutive utterances by one speaker into a paragraph and shows in-progress words (partials) as they are recognized. The microphone is always **You**; call-audio speakers get stable ids, and diarization can relabel an utterance later.
- **Side threads.** Each thread is a separate Codex thread started with `sandbox: "read-only"` and `approvalPolicy: "never"` in the first research folder. The read-only sandbox blocks writes and network access for the commands the agent runs. It does **not** confine reads to the research folders: those are where the agent starts and is told to look. Confining reads needs a Codex permission profile (experimental in Codex 0.158). Codex's own web search tool, if your Codex config enables it, is separate from the sandbox. One `codex app-server` process serves every thread, and turns on different threads run concurrently (six at a time by default, then queued). Any approval or input request from Codex is declined.
- **What the agent sees.**
  - The meeting title and brief, and who is speaking.
  - The selected quote, with about 2.5 minutes of surrounding transcript. If the selection is old, it also gets what is being said now.
  - The question.
  - The path to `transcript.md`, which is rewritten as people talk, so the agent can read more of the conversation itself.
  - Follow-ups carry only what was said since the last answer.
  - The instructions ask for a one-sentence answer first, then evidence, and tell the agent to treat transcript text as quoted speech, never as instructions.
- **Persistence.** Each meeting lives in `~/.threaded/live/meetings/<id>/` (`meeting.json`, `transcript.md`, owner-only permissions). Refreshing the page loses nothing. If the server restarts, in-flight threads are marked interrupted, and a follow-up resumes the same Codex conversation.

**Privacy.** Audio and transcripts stay on your machine. Asking a question sends the context above, plus whatever files the agent chooses to read, to your Codex model provider. Nothing touches the hosted Threaded sharing API.

## Transcript source protocol

A source is any executable that writes newline-delimited JSON to stdout. Other stdout lines are ignored, and stderr is for diagnostics. Times are seconds since the source started; the server offsets them when a meeting is resumed. The server writes `stop\n` to stdin to ask for a graceful flush and exit, and signals the process if it does not exit within 10 s.

```json
{"type":"status","state":"starting"}
{"type":"status","state":"listening"}
{"type":"speaker","id":"them-1","name":"Priya"}
{"type":"partial","channel":"them","speaker":"them-1","text":"so the main thing","start":12.4}
{"type":"utterance","id":"u17","channel":"them","speaker":"them-1","text":"So the main thing is the retry logic.","start":12.4,"end":15.1}
{"type":"relabel","id":"u17","speaker":"them-2"}
{"type":"utterance","id":"u18","channel":"me","text":"Which worker?","start":15.6,"end":16.4}
{"type":"error","message":"Microphone permission was denied."}
{"type":"status","state":"stopped"}
```

- `channel` is `me` (local microphone) or `them` (call audio). `me` utterances are always attributed to **You**.
- Utterance `id`s must be unique within a recording. Re-sending an id replaces that utterance.
- `speaker` names are hints; a name the user typed always wins.
- Ids match `[\w:.-]{1,64}`. Malformed protocol messages stop the source with a visible error.

`live/replay.ts` implements this protocol and is the reference source.

## Tests

```bash
pnpm test:live                                  # reducer, context, replay, Codex adapter, HTTP API
THREADED_TEST_CODEX=codex pnpm test:live        # also drives your real Codex CLI
```

The Codex adapter tests use a scripted app-server (`live/test/fixtures/fake-app-server.ts`) that replays message shapes recorded from codex-cli 0.158.

The opt-in real test starts your actual `codex app-server` against a local fake model. It needs no login and spends no tokens, but command execution, the read-only sandbox, and interrupts are all real. Run it after upgrading Codex to catch protocol changes.

## Phase 2: macOS audio helper

What the helper must do: capture the call and your microphone on a Mac, turn them into the protocol above, and nothing else. Everything below comes from research as of September 2026 and has **not yet been built or measured**. Treat it as the plan to validate, not a result.

### Capture

- **Call audio: a Core Audio process tap on the call app.**
  - Uses `AudioHardwareCreateProcessTap` with a `CATapDescription`, on macOS 14.2+.
  - Needs only the audio-capture permission (`NSAudioCaptureUsageDescription`), not Screen Recording.
  - Tap only the chosen app: Zoom, Slack, Teams, FaceTime, or Chrome/Arc for Meet.
  - Chrome plays audio from its helper processes, so match every process with the app's bundle id prefix.
  - A denied permission delivers silence, not an error. Detect sustained digital silence while the call app is running and emit an `error`.
  - References: Apple's sample [Capturing system audio with Core Audio taps](https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps) and [AudioCap](https://github.com/insidegui/AudioCap).
- **Microphone: capture raw, and cancel echo in software using the tap as the reference.**
  - Apple's voice-processing I/O ducks the call audio and reportedly conflicts with process taps.
  - Options: [FluidAudio](https://github.com/FluidInference/FluidAudio)'s beta `LocalVqeManager` (on `main`), or, as a first step, suppress mic frames that correlate with recent tap audio.
  - Headphones remain the fallback.
- **Packaging: a signed `.app`**, not a bare binary.
  - Hardened runtime, the `com.apple.security.device.audio-input` entitlement, and both usage strings.
  - macOS attributes permissions to the process that launched the helper. A binary started from Terminal via Node would prompt as, and be granted to, Terminal.
  - Launched through LaunchServices, the app cannot use a stdin/stdout pipe. Plan to add a Unix-socket transport to the server (`~/.threaded/live/audio.sock`, owner-only) carrying the same JSONL both ways.

### Recognition

- **Utterance boundaries:** FluidAudio `VadManager` (Silero) in streaming mode.
- **Speech-to-text:** FluidAudio streaming ASR.
  - `StreamingEouAsrManager` (Parakeet EOU, English, end-of-utterance callbacks) gives the lowest latency.
  - `SlidingWindowAsrManager` (Parakeet TDT v3, 25 languages) exposes volatile and confirmed text, which map directly to `partial` and `utterance`.
  - On macOS 26, Apple's `SpeechTranscriber` is an alternative with similar reported accuracy, but no diarization.
- **Speakers:** run diarization on the `them` channel only.
  - A 1:1 call is then labelled perfectly by channel alone.
  - For groups, FluidAudio `LSEENDDiarizer` supports up to 10 speakers with 100 ms updates; `SortformerDiarizer` supports 4 speakers with more stable ids.
  - Send `relabel` when the diarizer revises an earlier utterance.
  - Later: store speaker embeddings, so a name you give someone carries over to the next call.

### Milestones and acceptance checks

1. **Microphone only.**
   - Permissions prompt as "Threaded Audio".
   - Partials appear within about 1 s of speech; utterances within about 1.5 s of a pause.
   - `stop` flushes the last words.
2. **Plus the call app tap** on Zoom and on Meet in Chrome. Nothing from other apps (music, notifications) appears.
3. **Plus diarization.** Record a 10-minute call with three people and check:
   - The speaker count.
   - How quickly relabels settle.
   - Names persisting after renaming.
4. **Without headphones.** Remote speech must not also appear as **You**.
5. **Load.** A 60-minute call, with CPU and memory recorded on an M1-class machine and a MacBook Air, and no effect on call quality.

## Known limits

- Only replay is implemented as a source today. Live audio needs the phase 2 helper.
- `/live` exists only on the local server. The hosted site shows a "cannot reach the local server" screen there.
- The global hotkey and an always-on-top floating panel need a native shell and are not built yet. ⌘K works while the Threaded tab is focused.
- Only Codex is supported as a research agent. The executor interface (`live/executors/types.ts`) is small, so adding the Claude Agent SDK or another agent is a single adapter file.
