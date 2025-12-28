#!/usr/bin/env node
import { program } from 'commander'
import path from 'path'
import open from 'open'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'

const DEFAULT_API = 'https://threaded.andypai.me'

// Read version from package.json
function getVersion(): string {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const pkgPath = path.resolve(__dirname, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

// Safely extract error message from response (handles HTML/text responses)
async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error || fallback
  } catch {
    const text = await res.text().catch(() => '')
    return text.slice(0, 100) || fallback
  }
}
const DIRECT_EXTS = new Set(['.md', '.txt', '.markdown'])
const PARSE_EXTS = new Set(['.pdf', '.docx', '.xlsx', '.pptx', '.epub', '.csv', '.html', '.xml'])

interface CreateSessionResponse {
  sessionId: string
}

interface ParseResponse {
  markdown: string
}

/**
 * Ensures a URL is valid and doesn't have trailing slashes
 */
function normalizeUrl(url: string): string {
  const base = url.startsWith('http') ? url : `https://${url}`
  return base.replace(/\/+$/, '')
}

/**
 * Safely joins a base URL with a path
 */
function joinUrl(base: string, subpath: string): string {
  const normalizedBase = normalizeUrl(base)
  const normalizedPath = subpath.replace(/^\/+/, '')
  return `${normalizedBase}/${normalizedPath}`
}

async function getMarkdownForFile(apiBase: string, filepath: string): Promise<string> {
  const absPath = path.resolve(filepath)

  if (!existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`)
  }

  const ext = path.extname(absPath).toLowerCase()
  const filename = path.basename(absPath)

  if (DIRECT_EXTS.has(ext)) {
    const text = readFileSync(absPath, 'utf-8')
    if (!text.trim()) throw new Error('File is empty')
    return text
  }

  if (PARSE_EXTS.has(ext)) {
    console.info(`Parsing ${filename}...`)
    const buffer = readFileSync(absPath)
    const formData = new FormData()
    formData.append('file', new Blob([buffer]), filename)

    const res = await fetch(joinUrl(apiBase, 'api/parse'), {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const errMsg = await getErrorMessage(res, `Parse failed: ${res.status}`)
      throw new Error(errMsg)
    }

    const data = (await res.json()) as ParseResponse
    return data.markdown
  }

  throw new Error(
    `Unsupported file type: ${ext}\nSupported: ${[...DIRECT_EXTS, ...PARSE_EXTS].join(', ')}`,
  )
}

async function createSession(apiBase: string, markdown: string): Promise<string> {
  const res = await fetch(joinUrl(apiBase, 'api/sessions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdownContent: markdown }),
  })

  if (!res.ok) {
    const errMsg = await getErrorMessage(res, `Failed to create session: ${res.status}`)
    throw new Error(errMsg)
  }

  const { sessionId } = (await res.json()) as CreateSessionResponse
  return sessionId
}

program
  .name('threaded')
  .description('Open local files in Threaded for AI-powered reading')
  .version(getVersion())
  .argument('<filepath>', 'File to open in Threaded')
  .option('--no-open', 'Print URL without opening browser')
  .option('--api <url>', 'API base URL (default: https://threaded.andypai.me)')
  .option('--app <url>', 'App base URL to open (default: same as --api)')
  .action(async (filepath: string, options: { open: boolean; api?: string; app?: string }) => {
    try {
      const apiBase = options.api ?? process.env.THREADED_API ?? DEFAULT_API
      const appBase = options.app ?? process.env.THREADED_APP ?? apiBase

      const markdown = await getMarkdownForFile(apiBase, filepath)
      const sessionId = await createSession(apiBase, markdown)

      const url = joinUrl(appBase, sessionId)
      console.info(url)

      if (options.open) {
        try {
          await open(url)
        } catch {
          console.warn('Could not open browser automatically')
        }
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'An error occurred')
      process.exit(1)
    }
  })

program.parse()
