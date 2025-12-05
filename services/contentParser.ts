export interface ParseResult {
  markdown: string
  source: "file" | "url"
}

interface ParseErrorResponse {
  error?: string
}

export async function parseFile(file: File): Promise<ParseResult> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("/api/parse", {
    method: "POST",
    body: formData,
  })

  const data: ParseResult | ParseErrorResponse = await response.json()

  if (!response.ok) {
    const errorData = data as ParseErrorResponse
    throw new Error(errorData.error || "Failed to parse file")
  }

  return data as ParseResult
}

export async function parseUrl(url: string): Promise<ParseResult> {
  const response = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })

  const data: ParseResult | ParseErrorResponse = await response.json()

  if (!response.ok) {
    const errorData = data as ParseErrorResponse
    throw new Error(errorData.error || "Failed to fetch URL")
  }

  return data as ParseResult
}
