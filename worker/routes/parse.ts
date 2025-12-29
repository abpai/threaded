import type { Env } from '../types'
import { jsonResponse, errorResponse } from '../utils/response'
import { MAX_FILE_SIZE } from '../utils/validation'
import { parseWithCache } from '../utils/cache'
import { fixMalformedTables } from '../utils/markdown'
import { parseWithDatalab } from '../utils/datalab'
import { parseUrlWithJina } from '../utils/jina'

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'csv', 'html', 'xml', 'pptx', 'epub']
const URL_CACHE_TTL_MS = 6 * 60 * 60 * 1000

function isValidPublicUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false
    }
    const hostname = url.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname.endsWith('.local') ||
      hostname === '[::1]'
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

async function handleFileUpload(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return errorResponse('No file provided', 400)
  }

  if (file.size > MAX_FILE_SIZE) {
    return errorResponse('File too large (max 10MB)', 400)
  }

  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'md' || ext === 'txt') {
    const text = await file.text()
    if (!text.trim()) {
      return errorResponse('File is empty', 400)
    }
    return jsonResponse({ markdown: fixMalformedTables(text), source: 'file' })
  }

  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return errorResponse(
      `Unsupported file type. Allowed: .md, .txt, .pdf, .docx, .xlsx, .pptx, .epub`,
      400
    )
  }

  if (!env.DATALAB_API_KEY) {
    return errorResponse('Datalab API key not configured for file parsing', 500)
  }

  try {
    const fileBuffer = await file.arrayBuffer()
    const fileBlob = new Blob([fileBuffer], { type: file.type })

    const { markdown, cached } = await parseWithCache(
      env.DB,
      fileBuffer,
      'file',
      () => parseWithDatalab(fileBlob, file.name, env.DATALAB_API_KEY),
      { filename: file.name, fileSize: file.size }
    )

    return jsonResponse({ markdown, source: 'file', cached })
  } catch (e) {
    console.error('File parse error:', e)
    const message = e instanceof Error ? e.message : 'Failed to process file'
    return errorResponse(message, 500)
  }
}

async function handleUrlParse(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { url?: string }
  const url = body.url

  if (!url || typeof url !== 'string') {
    return errorResponse('URL is required', 400)
  }

  if (!isValidPublicUrl(url)) {
    return errorResponse('Invalid URL: must be a public http/https URL', 400)
  }

  try {
    const { markdown, cached } = await parseWithCache(
      env.DB,
      url,
      'url',
      () => parseUrlWithJina(url, env.JINA_API_KEY),
      { url, cacheTtlMs: URL_CACHE_TTL_MS }
    )

    return jsonResponse({ markdown, source: 'url', cached })
  } catch (e) {
    console.error('URL parse error:', e)
    const message = e instanceof Error ? e.message : 'Failed to fetch URL'
    return errorResponse(message, 500)
  }
}

export async function handleParse(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    return handleFileUpload(request, env)
  }

  if (contentType.includes('application/json')) {
    return handleUrlParse(request, env)
  }

  return errorResponse('Invalid request format', 400)
}
