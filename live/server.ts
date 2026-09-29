// Entry point: `pnpm live [options]`. Starts the local server, then opens the browser.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLiveApp, type SourceConfig } from './app.ts'
import { CodexExecutor } from './executors/codex.ts'
import { MockExecutor } from './executors/mock.ts'
import type { Executor } from './executors/types.ts'

const HELP = `Threaded Live: a live transcript with parallel side threads that research on your machine.

Usage: pnpm live [options]

Transcript source (pick one):
  --replay <file>       Replay a transcript file as if it were live (see live/fixtures)
  --speed <n>           Replay speed multiplier (default 1)
  --audio <command>     Run an audio helper speaking the source protocol (docs/LIVE.md)

Research:
  --root <dir>          Folder the agent researches (repeatable; default: current directory)
  --executor <name>     codex (default) or mock
  --codex <path>        Codex binary (default: codex on PATH)
  --model <id>          Codex model override
  --effort <level>      Codex reasoning effort override (e.g. low, medium)

Server:
  --port <n>            Port on 127.0.0.1 (default 4319)
  --data <dir>          Where meetings are stored (default ~/.threaded/live)
  --no-open             Do not open the browser
  --dev                 API only, for use with the Vite dev server (pnpm dev:live)
`

function parseArgs(argv: string[]) {
  const values = new Map<string, string[]>()
  const flags = new Set<string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') continue
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`)
    const key = arg.slice(2)
    if (['no-open', 'dev', 'help'].includes(key)) flags.add(key)
    else {
      const value = argv[++i]
      if (value === undefined) throw new Error(`Missing value for --${key}`)
      values.set(key, [...(values.get(key) ?? []), value])
    }
  }
  return {
    get: (key: string) => values.get(key)?.at(-1),
    all: (key: string) => values.get(key) ?? [],
    flags,
  }
}

function commandExists(command: string) {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0
}

function openBrowser(url: string) {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]]
  spawn(command, args, { stdio: 'ignore', detached: true })
    .on('error', () => {})
    .unref()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.flags.has('help')) return void process.stdout.write(HELP)

  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const version = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version ?? '0'
  // pnpm runs scripts from the package root; INIT_CWD is where the user typed the command.
  const cwd = process.env.INIT_CWD || process.cwd()
  const roots = (args.all('root').length ? args.all('root') : [cwd]).map(dir =>
    realpathSync(resolve(cwd, dir))
  )

  let source: SourceConfig | null = null
  const replay = args.get('replay')
  const audio = args.get('audio')
  if (replay) {
    const file = resolve(cwd, replay)
    if (!existsSync(file)) throw new Error(`Replay file not found: ${file}`)
    source = {
      label: `Replay · ${file.split('/').at(-1)}`,
      command: process.execPath,
      args: [join(repoRoot, 'live', 'replay.ts'), file, '--speed', args.get('speed') ?? '1'],
    }
  } else if (audio) {
    source = { label: 'Audio helper', command: resolve(cwd, audio), args: [] }
  }

  const codexCommand = args.get('codex') ?? process.env.THREADED_CODEX ?? 'codex'
  let executorName = args.get('executor') ?? 'codex'
  if (executorName === 'codex' && !commandExists(codexCommand)) {
    console.warn(
      `! Codex not found (${codexCommand}). Using the mock executor; install Codex and run \`codex login\` for real research.`
    )
    executorName = 'mock'
  }
  let executor: Executor
  if (executorName === 'codex')
    executor = new CodexExecutor({
      command: codexCommand,
      model: args.get('model'),
      effort: args.get('effort'),
      version,
    })
  else if (executorName === 'mock') executor = new MockExecutor()
  else throw new Error(`Unknown executor: ${executorName}`)

  const dev = args.flags.has('dev')
  const staticDir = dev ? null : join(repoRoot, 'dist')
  if (staticDir && !existsSync(join(staticDir, 'index.html'))) {
    console.log('Building the web app (first run)…')
    const build = spawnSync(join(repoRoot, 'node_modules', '.bin', 'vite'), ['build'], {
      cwd: repoRoot,
      stdio: 'inherit',
    })
    if (build.status !== 0) throw new Error('Web build failed; run `pnpm build` to see why.')
  }

  const port = Number(args.get('port') ?? 4319)
  const app = createLiveApp({
    dataDir: resolve(cwd, args.get('data') ?? join(homedir(), '.threaded', 'live')),
    roots,
    executor,
    source,
    staticDir,
    version,
  })
  app.server.listen(port, '127.0.0.1', () => {
    const url = dev ? 'http://localhost:3000/live' : `http://localhost:${port}/live`
    console.log(
      [
        `Threaded Live  ${url}`,
        `  executor   ${executor.name}`,
        `  research   ${roots.join(', ')}`,
        `  source     ${source?.label ?? 'none (start with --replay <file> or --audio <command>)'}`,
        `  transcript ${app.store.transcriptPath()}`,
      ].join('\n')
    )
    if (!dev && !args.flags.has('no-open')) openBrowser(url)
  })
  app.server.on('error', error => {
    console.error(`Could not listen on 127.0.0.1:${port}: ${error.message}`)
    process.exit(1)
  })

  let closing = false
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, async () => {
      if (closing) process.exit(1)
      closing = true
      await app.close()
      process.exit(0)
    })
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
