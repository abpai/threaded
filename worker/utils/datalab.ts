const DATALAB_API_URL = "https://www.datalab.to/api/v1/marker"
const MAX_POLL_ATTEMPTS = 60
const POLL_INTERVAL_MS = 2000

interface DatalabSubmitResponse {
  success: boolean
  error?: string | null
  request_id?: string
  request_check_url?: string
}

interface DatalabResultResponse {
  success: boolean
  status: "pending" | "complete" | "error"
  markdown?: string
  error?: string
}

async function pollForResult(checkUrl: string, apiKey: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const response = await fetch(checkUrl, {
      headers: { "X-API-Key": apiKey },
    })

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.status}`)
    }

    const result = (await response.json()) as DatalabResultResponse

    if (result.status === "complete") {
      if (!result.markdown) {
        throw new Error("Parsing completed but no markdown returned")
      }
      return result.markdown
    }

    if (result.status === "error") {
      throw new Error(result.error || "Parsing failed")
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  throw new Error("Parsing timed out")
}

export async function parseWithDatalab(
  file: File | Blob,
  filename: string,
  apiKey: string
): Promise<string> {
  const form = new FormData()
  form.append("file", file, filename)
  form.append("output_format", "markdown")
  form.append("skip_cache", "false")
  form.append("force_ocr", "true")
  form.append("use_llm", "true")

  const response = await fetch(DATALAB_API_URL, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: form,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Datalab API error: ${response.status} ${text}`)
  }

  const result = (await response.json()) as DatalabSubmitResponse

  if (!result.success) {
    throw new Error(result.error || "Failed to submit document for parsing")
  }

  if (!result.request_check_url) {
    throw new Error("No check URL returned from Datalab")
  }

  return pollForResult(result.request_check_url, apiKey)
}
