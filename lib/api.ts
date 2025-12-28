/**
 * API messages use "model" for AI responses while the frontend uses "assistant".
 * Translation happens in useSession.ts when loading/saving messages.
 */
export interface ApiMessage {
  id: string
  role: 'user' | 'model'
  text: string
  timestamp: number
}

export interface ApiThread {
  id: string
  context: string
  snippet: string
  createdAt: number
  messages: ApiMessage[]
}

export interface ApiSession {
  id: string
  markdownContent: string
  createdAt: number
  updatedAt: number
  forkedFrom: string | null
  threads: ApiThread[]
}

export interface CreateSessionResponse {
  sessionId: string
  ownerToken: string
}

export interface AddThreadResponse {
  threadId: string
  createdAt: number
}

export interface AddMessageResponse {
  messageId: string
  timestamp: number
}

export interface ForkSessionResponse {
  sessionId: string
  ownerToken: string
  threadIdMap: Record<string, string>
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Retry with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | null = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))

      // Don't retry on client errors (4xx)
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        throw e
      }

      // Wait before retry (1s, 2s, 4s)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
      }
    }
  }

  if (!lastError) {
    throw new Error('Request failed after retries')
  }
  throw lastError
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = (await response.json()) as { error?: string } & T

  if (!response.ok) {
    throw new ApiError(data.error || 'Request failed', response.status)
  }

  return data as T
}

export async function createSession(markdownContent: string): Promise<CreateSessionResponse> {
  return withRetry(() =>
    request<CreateSessionResponse>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ markdownContent }),
    })
  )
}

export async function getSession(sessionId: string): Promise<ApiSession> {
  return withRetry(() => request<ApiSession>(`/api/sessions/${sessionId}`))
}

export async function deleteSession(sessionId: string, ownerToken: string): Promise<void> {
  await withRetry(() =>
    request<{ success: boolean }>(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'X-Owner-Token': ownerToken },
    })
  )
}

export async function addThread(
  sessionId: string,
  ownerToken: string,
  context: string,
  snippet: string
): Promise<AddThreadResponse> {
  return withRetry(() =>
    request<AddThreadResponse>(`/api/sessions/${sessionId}/threads`, {
      method: 'POST',
      headers: { 'X-Owner-Token': ownerToken },
      body: JSON.stringify({ context, snippet }),
    })
  )
}

export async function deleteThread(
  sessionId: string,
  ownerToken: string,
  threadId: string
): Promise<void> {
  await withRetry(() =>
    request<{ success: boolean }>(`/api/sessions/${sessionId}/threads/${threadId}`, {
      method: 'DELETE',
      headers: { 'X-Owner-Token': ownerToken },
    })
  )
}

export async function addMessage(
  sessionId: string,
  ownerToken: string,
  threadId: string,
  role: 'user' | 'model',
  text: string
): Promise<AddMessageResponse> {
  return withRetry(() =>
    request<AddMessageResponse>(`/api/sessions/${sessionId}/threads/${threadId}/messages`, {
      method: 'POST',
      headers: { 'X-Owner-Token': ownerToken },
      body: JSON.stringify({ role, text }),
    })
  )
}

export async function updateMessage(
  sessionId: string,
  ownerToken: string,
  threadId: string,
  messageId: string,
  text: string
): Promise<void> {
  await withRetry(() =>
    request<{ success: boolean }>(
      `/api/sessions/${sessionId}/threads/${threadId}/messages/${messageId}`,
      {
        method: 'PUT',
        headers: { 'X-Owner-Token': ownerToken },
        body: JSON.stringify({ text }),
      }
    )
  )
}

export async function truncateThread(
  sessionId: string,
  ownerToken: string,
  threadId: string,
  afterMessageId: string
): Promise<void> {
  await withRetry(() =>
    request<{ success: boolean }>(
      `/api/sessions/${sessionId}/threads/${threadId}/messages?after=${encodeURIComponent(afterMessageId)}`,
      {
        method: 'DELETE',
        headers: { 'X-Owner-Token': ownerToken },
      }
    )
  )
}

export async function forkSession(sessionId: string): Promise<ForkSessionResponse> {
  return withRetry(() =>
    request<ForkSessionResponse>(`/api/sessions/${sessionId}/fork`, {
      method: 'POST',
    })
  )
}
