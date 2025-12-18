import type { Env } from "../types"
import { nanoid } from "../utils/nanoid"
import { jsonResponse, errorResponse } from "../utils/response"
import { validateString, LIMITS } from "../utils/validation"
import { verifyOwnerToken } from "../middleware/auth"

export async function handleAddThread(
  request: Request,
  env: Env,
  sessionId: string
): Promise<Response> {
  const ownerToken = request.headers.get("X-Owner-Token")

  if (!(await verifyOwnerToken(env, sessionId, ownerToken))) {
    return errorResponse("Forbidden", 403)
  }

  try {
    const body = (await request.json()) as { context?: unknown; snippet?: unknown }
    const context = validateString(body.context, LIMITS.context, "context")
    const snippet = validateString(body.snippet, LIMITS.snippet, "snippet")

    const threadId = nanoid(21)
    const now = Date.now()

    await env.DB.prepare(
      "INSERT INTO threads (id, session_id, context, snippet, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(threadId, sessionId, context, snippet, now)
      .run()

    // Update session updated_at
    await env.DB.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
      .bind(now, sessionId)
      .run()

    return jsonResponse({ threadId, createdAt: now }, 201)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add thread"
    return errorResponse(message, 400)
  }
}

export async function handleAddMessage(
  request: Request,
  env: Env,
  sessionId: string,
  threadId: string
): Promise<Response> {
  const ownerToken = request.headers.get("X-Owner-Token")

  if (!(await verifyOwnerToken(env, sessionId, ownerToken))) {
    return errorResponse("Forbidden", 403)
  }

  try {
    // Verify thread belongs to session
    const thread = await env.DB.prepare("SELECT id FROM threads WHERE id = ? AND session_id = ?")
      .bind(threadId, sessionId)
      .first()
    if (!thread) {
      return errorResponse("Thread not found", 404)
    }

    const body = (await request.json()) as { role?: unknown; text?: unknown }
    const text = validateString(body.text, LIMITS.text, "text")

    if (body.role !== "user" && body.role !== "model") {
      return errorResponse("role must be 'user' or 'model'", 400)
    }
    const role = body.role

    const messageId = nanoid(21)
    const now = Date.now()

    await env.DB.prepare(
      "INSERT INTO messages (id, thread_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(messageId, threadId, role, text, now)
      .run()

    // Update session updated_at
    await env.DB.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
      .bind(now, sessionId)
      .run()

    return jsonResponse({ messageId, timestamp: now }, 201)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add message"
    return errorResponse(message, 400)
  }
}

export async function handleUpdateMessage(
  request: Request,
  env: Env,
  sessionId: string,
  threadId: string,
  messageId: string
): Promise<Response> {
  const ownerToken = request.headers.get("X-Owner-Token")

  if (!(await verifyOwnerToken(env, sessionId, ownerToken))) {
    return errorResponse("Forbidden", 403)
  }

  try {
    const body = (await request.json()) as { text?: unknown }
    const text = validateString(body.text, LIMITS.text, "text")
    const now = Date.now()

    // Verify message exists and belongs to thread/session
    const message = await env.DB.prepare(
      `SELECT m.id 
       FROM messages m
       JOIN threads t ON m.thread_id = t.id
       WHERE m.id = ? AND m.thread_id = ? AND t.session_id = ?`
    )
      .bind(messageId, threadId, sessionId)
      .first()

    if (!message) {
      return errorResponse("Message not found", 404)
    }

    await env.DB.prepare("UPDATE messages SET text = ? WHERE id = ?").bind(text, messageId).run()

    // Update session updated_at
    await env.DB.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
      .bind(now, sessionId)
      .run()

    return jsonResponse({ success: true, timestamp: now }, 200)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update message"
    return errorResponse(message, 400)
  }
}

export async function handleTruncateThread(
  request: Request,
  env: Env,
  sessionId: string,
  threadId: string
): Promise<Response> {
  const ownerToken = request.headers.get("X-Owner-Token")

  if (!(await verifyOwnerToken(env, sessionId, ownerToken))) {
    return errorResponse("Forbidden", 403)
  }

  try {
    const url = new URL(request.url)
    const afterMessageId = url.searchParams.get("after")

    if (!afterMessageId) {
      return errorResponse("Missing 'after' query parameter", 400)
    }

    // Verify thread belongs to session
    const thread = await env.DB.prepare("SELECT id FROM threads WHERE id = ? AND session_id = ?")
      .bind(threadId, sessionId)
      .first()
    if (!thread) {
      return errorResponse("Thread not found", 404)
    }

    const message = await env.DB.prepare(
      `SELECT id, created_at FROM messages WHERE id = ? AND thread_id = ?`
    )
      .bind(afterMessageId, threadId)
      .first<{ id: string; created_at: number }>()

    if (!message) {
      return errorResponse("Message not found", 404)
    }

    await env.DB.prepare(
      `DELETE FROM messages
       WHERE thread_id = ?
       AND (created_at > ? OR (created_at = ? AND id != ?))`
    )
      .bind(threadId, message.created_at, message.created_at, message.id)
      .run()

    // Update session updated_at
    const now = Date.now()
    await env.DB.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
      .bind(now, sessionId)
      .run()

    return jsonResponse({ success: true }, 200)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to truncate thread"
    return errorResponse(message, 400)
  }
}
