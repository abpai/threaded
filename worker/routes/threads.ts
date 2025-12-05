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
