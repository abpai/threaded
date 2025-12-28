import type { D1PreparedStatement } from '@cloudflare/workers-types'
import type { Env } from '../types'
import { nanoid } from '../utils/nanoid'
import { jsonResponse, errorResponse } from '../utils/response'
import { validateString, ValidationError, LIMITS } from '../utils/validation'
import { verifyOwnerToken } from '../middleware/auth'

export async function handleCreateSession(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { markdownContent?: unknown }
    const markdownContent = validateString(
      body.markdownContent,
      LIMITS.markdownContent,
      'markdownContent'
    )

    const sessionId = nanoid(21)
    const ownerToken = nanoid(32)
    const now = Date.now()

    await env.DB.prepare(
      `INSERT INTO sessions (id, owner_token, markdown_content, created_at, updated_at, forked_from)
       VALUES (?, ?, ?, ?, ?, NULL)`
    )
      .bind(sessionId, ownerToken, markdownContent, now, now)
      .run()

    return jsonResponse({ sessionId, ownerToken }, 201)
  } catch (e) {
    if (e instanceof ValidationError) {
      return errorResponse(e.message, 400)
    }
    console.error('Create session error:', e)
    return errorResponse('Failed to create session', 500)
  }
}

export async function handleGetSession(env: Env, sessionId: string): Promise<Response> {
  try {
    // Get session
    const session = await env.DB.prepare(
      'SELECT id, markdown_content, created_at, updated_at, forked_from FROM sessions WHERE id = ?'
    )
      .bind(sessionId)
      .first<{
        id: string
        markdown_content: string
        created_at: number
        updated_at: number
        forked_from: string | null
      }>()

    if (!session) {
      return errorResponse('Session not found', 404)
    }

    // Get threads with messages
    const threadsResult = await env.DB.prepare(
      'SELECT id, context, snippet, created_at FROM threads WHERE session_id = ? ORDER BY created_at ASC'
    )
      .bind(sessionId)
      .all<{
        id: string
        context: string
        snippet: string
        created_at: number
      }>()

    const threads = threadsResult.results || []

    // Get messages for all threads
    const threadIds = threads.map(t => t.id)
    let messagesMap: Record<
      string,
      Array<{ id: string; role: string; text: string; created_at: number }>
    > = {}

    if (threadIds.length > 0) {
      // D1 doesn't support IN with array, so we need to query each thread
      for (const threadId of threadIds) {
        const messagesResult = await env.DB.prepare(
          'SELECT id, role, text, created_at FROM messages WHERE thread_id = ? ORDER BY created_at ASC'
        )
          .bind(threadId)
          .all<{
            id: string
            role: string
            text: string
            created_at: number
          }>()
        messagesMap[threadId] = messagesResult.results || []
      }
    }

    // Assemble response
    const threadsWithMessages = threads.map(t => ({
      id: t.id,
      context: t.context,
      snippet: t.snippet,
      createdAt: t.created_at,
      messages: (messagesMap[t.id] || []).map(m => ({
        id: m.id,
        role: m.role,
        text: m.text,
        timestamp: m.created_at,
      })),
    }))

    return jsonResponse({
      id: session.id,
      markdownContent: session.markdown_content,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      forkedFrom: session.forked_from,
      threads: threadsWithMessages,
    })
  } catch (e) {
    console.error('Get session error:', e)
    return errorResponse('Failed to get session', 500)
  }
}

export async function handleDeleteSession(
  request: Request,
  env: Env,
  sessionId: string
): Promise<Response> {
  const ownerToken = request.headers.get('X-Owner-Token')

  if (!(await verifyOwnerToken(env, sessionId, ownerToken))) {
    return errorResponse('Forbidden', 403)
  }

  try {
    // CASCADE will delete threads and messages
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
    return jsonResponse({ success: true })
  } catch (e) {
    console.error('Delete session error:', e)
    return errorResponse('Failed to delete session', 500)
  }
}

export async function handleForkSession(env: Env, sessionId: string): Promise<Response> {
  try {
    // Get original session
    const original = await env.DB.prepare('SELECT markdown_content FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<{ markdown_content: string }>()

    if (!original) {
      return errorResponse('Session not found', 404)
    }

    const newSessionId = nanoid(21)
    const newOwnerToken = nanoid(32)
    const now = Date.now()

    // Get threads for forking
    const threads = await env.DB.prepare(
      'SELECT id, context, snippet, created_at FROM threads WHERE session_id = ? ORDER BY created_at ASC'
    )
      .bind(sessionId)
      .all<{
        id: string
        context: string
        snippet: string
        created_at: number
      }>()

    // Build thread ID mapping and collect all messages
    const threadIdMap: Record<string, string> = {}
    const threadMessages: Array<{
      oldThreadId: string
      newThreadId: string
      messages: Array<{ role: string; text: string; created_at: number }>
    }> = []

    for (const thread of threads.results || []) {
      const newThreadId = nanoid(21)
      threadIdMap[thread.id] = newThreadId

      const messages = await env.DB.prepare(
        'SELECT role, text, created_at FROM messages WHERE thread_id = ? ORDER BY created_at ASC'
      )
        .bind(thread.id)
        .all<{
          role: string
          text: string
          created_at: number
        }>()

      threadMessages.push({
        oldThreadId: thread.id,
        newThreadId,
        messages: messages.results || [],
      })
    }

    // Collect all statements for atomic batch execution
    const statements: D1PreparedStatement[] = [
      env.DB.prepare(
        `INSERT INTO sessions (id, owner_token, markdown_content, created_at, updated_at, forked_from)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(newSessionId, newOwnerToken, original.markdown_content, now, now, sessionId),
    ]

    // Add thread insert statements
    for (const thread of threads.results || []) {
      const newThreadId = threadIdMap[thread.id]
      statements.push(
        env.DB.prepare(
          'INSERT INTO threads (id, session_id, context, snippet, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(newThreadId, newSessionId, thread.context, thread.snippet, thread.created_at)
      )
    }

    // Add message insert statements
    for (const { newThreadId, messages } of threadMessages) {
      for (const msg of messages) {
        const newMessageId = nanoid(21)
        statements.push(
          env.DB.prepare(
            'INSERT INTO messages (id, thread_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(newMessageId, newThreadId, msg.role, msg.text, msg.created_at)
        )
      }
    }

    // Execute all inserts atomically
    await env.DB.batch(statements)

    return jsonResponse({ sessionId: newSessionId, ownerToken: newOwnerToken, threadIdMap }, 201)
  } catch (e) {
    console.error('Fork session error:', e)
    return errorResponse('Failed to fork session', 500)
  }
}
