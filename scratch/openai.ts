import fs from 'node:fs/promises'
import process from 'node:process'
import * as api from '../lib/api'
import { generateThreadResponse, generateSessionSummary, ThreadMode } from '../services/aiService'
import { getSummaryPrompt, getSystemPrompt } from '../services/prompts'
import { AppSettings, Message, MessagePart, getTextFromParts } from '../types'

type Mode = ThreadMode | 'summary'

interface CliOptions {
  provider: AppSettings['provider']
  apiKey: string
  baseUrl?: string
  modelId: string
  mode: Mode
  context?: string
  message?: string
  file?: string
  sessionId?: string
  threadId?: string
  showPrompt: boolean
  apiBase: string
  debugTools: boolean
}

const DEFAULT_API_BASE = 'https://threaded.andypai.me'

const readStdin = async () => {
  if (process.stdin.isTTY) return ''
  return new Promise<string>(resolve => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data.trim()))
  })
}

const normalizeBase = (value: string) => value.replace(/\/+$/, '')

const withApiBase = async <T>(apiBase: string, fn: () => Promise<T>) => {
  const originalFetch = globalThis.fetch
  const normalizedBase = normalizeBase(apiBase)
  globalThis.fetch = (input, init) => {
    if (typeof input === 'string') {
      const url = input.startsWith('http') ? input : `${normalizedBase}${input}`
      return originalFetch(url, init)
    }
    return originalFetch(input, init)
  }
  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

const parseArgs = (argv: string[]): CliOptions => {
  const args = [...argv]
  const options: Partial<CliOptions> = {}

  const takeValue = () => {
    const value = args.shift()
    if (!value) throw new Error('Missing value for argument')
    return value
  }

  while (args.length > 0) {
    const arg = args.shift()
    if (!arg) continue

    switch (arg) {
      case '--provider':
        options.provider = takeValue() as AppSettings['provider']
        break
      case '--api-key':
        options.apiKey = takeValue()
        break
      case '--model':
        options.modelId = takeValue()
        break
      case '--base-url':
        options.baseUrl = takeValue()
        break
      case '--mode':
        options.mode = takeValue() as Mode
        break
      case '--context':
        options.context = takeValue()
        break
      case '--message':
        options.message = takeValue()
        break
      case '--file':
        options.file = takeValue()
        break
      case '--session':
        options.sessionId = takeValue()
        break
      case '--thread':
        options.threadId = takeValue()
        break
      case '--show-prompt':
        options.showPrompt = true
        break
      case '--api-base':
        options.apiBase = takeValue()
        break
      case '--debug-tools':
        options.debugTools = true
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return {
    provider:
      options.provider ?? ((process.env.AI_PROVIDER as AppSettings['provider']) || 'openai'),
    apiKey: options.apiKey ?? process.env.OPENAI_API_KEY ?? '',
    baseUrl: options.baseUrl ?? process.env.AI_BASE_URL,
    modelId: options.modelId ?? process.env.AI_MODEL_ID ?? 'gpt-5.2-chat-latest',
    mode: options.mode ?? ((process.env.AI_MODE as Mode) || 'discuss'),
    context: options.context,
    message: options.message,
    file: options.file,
    sessionId: options.sessionId,
    threadId: options.threadId,
    showPrompt: options.showPrompt ?? false,
    apiBase: options.apiBase ?? process.env.THREADED_API ?? DEFAULT_API_BASE,
    debugTools: options.debugTools ?? false,
  }
}

const mapApiThreadMessages = (thread: api.ApiThread): Message[] =>
  thread.messages.map(msg => ({
    id: msg.id,
    role: msg.role === 'model' ? 'assistant' : msg.role,
    parts: [{ type: 'text', text: msg.text }],
    text: msg.text,
    timestamp: msg.timestamp,
  }))

const loadDocument = async (options: CliOptions) => {
  if (options.sessionId) {
    return withApiBase(options.apiBase, async () => api.getSession(options.sessionId!))
  }
  return null
}

const loadFile = async (filepath: string) => {
  const buffer = await fs.readFile(filepath, 'utf8')
  return buffer.toString()
}

// Tool display metadata (mirrors ToolInvocationRenderer.tsx)
const toolDisplayNames: Record<string, string> = {
  web_search: 'Web Search',
  google_search: 'Google Search',
}

interface SearchResult {
  title?: string
  url?: string
  snippet?: string
  description?: string
}

interface SearchToolResult {
  results?: SearchResult[]
  sources?: SearchResult[]
  content?: string
  error?: boolean | string
  message?: string
}

const getToolDisplayName = (toolName: string): string =>
  toolDisplayNames[toolName] || toolName

const getErrorMessage = (result: unknown): string | null => {
  if (!result || typeof result !== 'object') return null
  const r = result as SearchToolResult
  if (r.error === true) return r.message || 'Tool failed'
  if (typeof r.error === 'string') return r.error
  return null
}

const formatSearchResults = (result: unknown): string | null => {
  if (!result || typeof result !== 'object') return null
  const r = result as SearchToolResult
  const items = r.results || r.sources || []
  if (items.length === 0) {
    if (r.content) return `  Content: ${r.content}`
    return null
  }
  const lines = ['  Results:']
  items.slice(0, 5).forEach((item, idx) => {
    lines.push(`    ${idx + 1}. ${item.title || 'Untitled'}`)
    if (item.url) lines.push(`       ${item.url}`)
    if (item.snippet || item.description) {
      const text = (item.snippet || item.description || '').slice(0, 120)
      lines.push(`       ${text}${text.length >= 120 ? '...' : ''}`)
    }
  })
  return lines.join('\n')
}

const renderToolParts = (parts: MessagePart[]) => {
  for (const part of parts) {
    if (part.type !== 'tool-invocation') continue

    const displayName = getToolDisplayName(part.toolName)
    const stateIcon =
      part.state === 'result' ? '✓' : part.state === 'call' ? '→' : '…'

    console.log(`\n━━━ ${displayName} ━━━`)

    // Show args (especially query for search tools)
    if (part.args && typeof part.args === 'object') {
      const args = part.args as Record<string, unknown>
      if (args.query) {
        console.log(`  Query: "${args.query}"`)
      } else {
        console.log(`  Args: ${JSON.stringify(args)}`)
      }
    }

    console.log(`  Status: ${stateIcon} ${part.state}`)

    if (part.state === 'result' && part.result !== undefined) {
      const errorMsg = getErrorMessage(part.result)
      if (errorMsg) {
        console.log(`  Error: ${errorMsg}`)
      } else {
        const formatted = formatSearchResults(part.result)
        if (formatted) {
          console.log(formatted)
        } else {
          // Fallback: show raw result
          const raw =
            typeof part.result === 'string'
              ? part.result
              : JSON.stringify(part.result, null, 2)
          console.log(`  Result: ${raw.slice(0, 500)}${raw.length > 500 ? '...' : ''}`)
        }
      }
    }
  }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const settings: AppSettings = {
    provider: options.provider,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    modelId: options.modelId,
  }

  let document = ''
  let history: Message[] = []
  let context = options.context ?? 'Entire Document'

  const session = await loadDocument(options)
  if (session) {
    document = session.markdownContent
    if (options.threadId) {
      const thread = session.threads.find(t => t.id === options.threadId)
      if (!thread) throw new Error(`Thread not found: ${options.threadId}`)
      context = options.context ?? thread.context
      history = mapApiThreadMessages(thread)
    }
  } else if (options.file) {
    document = await loadFile(options.file)
  } else {
    document = ''
  }

  if (options.showPrompt) {
    const prompt =
      options.mode === 'summary'
        ? getSummaryPrompt(document)
        : getSystemPrompt(context, document, options.mode)
    console.log(prompt)
  }

  if (options.mode === 'summary') {
    const summary = await generateSessionSummary(document, settings)
    if (summary) {
      console.log(summary)
    } else {
      console.error('Failed to generate summary.')
      process.exit(1)
    }
    return
  }

  const message = options.message || (await readStdin())
  if (!message.trim()) {
    console.error('No message provided. Use --message or pipe via stdin.')
    process.exit(1)
  }

  const { parts, text } = await generateThreadResponse(
    context,
    document,
    history,
    message,
    settings,
    options.mode
  )

  console.log(text)

  if (options.debugTools) {
    renderToolParts(parts)
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
