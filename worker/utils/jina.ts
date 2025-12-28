export async function parseUrlWithJina(url: string, apiKey?: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`

  const headers: Record<string, string> = { Accept: 'text/markdown' }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const response = await fetch(jinaUrl, { headers })

  if (!response.ok) {
    throw new Error(`Jina Reader error: ${response.status}`)
  }

  return response.text()
}
