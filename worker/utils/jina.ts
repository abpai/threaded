export async function parseUrlWithJina(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`

  const response = await fetch(jinaUrl, {
    headers: { Accept: "text/markdown" },
  })

  if (!response.ok) {
    throw new Error(`Jina Reader error: ${response.status}`)
  }

  return response.text()
}
