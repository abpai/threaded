export interface ParseResult {
  markdown: string
  source: 'file' | 'url'
}

interface ParseErrorResponse {
  error?: string
}

export async function parseFile(file: File): Promise<ParseResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/parse', {
    method: 'POST',
    body: formData,
  })

  const text = await response.text()
  let data: ParseResult | ParseErrorResponse | null = null
  try {
    data = JSON.parse(text) as ParseResult | ParseErrorResponse
  } catch {
    data = null
  }

  if (!response.ok) {
    const errorData = data as ParseErrorResponse
    const message = errorData?.error || text || 'Failed to parse file'
    throw new Error(message)
  }

  if (!data || !('markdown' in data)) {
    throw new Error('Invalid response from parser')
  }

  return data as ParseResult
}

export async function parseUrl(url: string): Promise<ParseResult> {
  const response = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  const text = await response.text()
  let data: ParseResult | ParseErrorResponse | null = null
  try {
    data = JSON.parse(text) as ParseResult | ParseErrorResponse
  } catch {
    data = null
  }

  if (!response.ok) {
    const errorData = data as ParseErrorResponse
    const message = errorData?.error || text || 'Failed to fetch URL'
    throw new Error(message)
  }

  if (!data || !('markdown' in data)) {
    throw new Error('Invalid response from parser')
  }

  return data as ParseResult
}
