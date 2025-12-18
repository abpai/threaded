import type { Env } from "./types"
import { corsHeaders } from "./utils/response"
import { errorResponse } from "./utils/response"
import {
  handleCreateSession,
  handleGetSession,
  handleDeleteSession,
  handleForkSession,
} from "./routes/sessions"
import {
  handleAddThread,
  handleAddMessage,
  handleUpdateMessage,
  handleTruncateThread,
} from "./routes/threads"
import { handleParse } from "./routes/parse"

async function handleApiRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname
  const method = request.method

  // OPTIONS preflight
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  // POST /api/parse - Parse file or URL to markdown
  if (path === "/api/parse" && method === "POST") {
    return handleParse(request, env)
  }

  // POST /api/sessions - Create session
  if (path === "/api/sessions" && method === "POST") {
    return handleCreateSession(request, env)
  }

  // GET /api/sessions/:id - Get session
  const getSessionMatch = path.match(/^\/api\/sessions\/([a-zA-Z0-9_-]+)$/)
  if (getSessionMatch && method === "GET") {
    return handleGetSession(env, getSessionMatch[1])
  }

  // DELETE /api/sessions/:id - Delete session
  if (getSessionMatch && method === "DELETE") {
    return handleDeleteSession(request, env, getSessionMatch[1])
  }

  // POST /api/sessions/:id/threads - Add thread
  const addThreadMatch = path.match(/^\/api\/sessions\/([a-zA-Z0-9_-]+)\/threads$/)
  if (addThreadMatch && method === "POST") {
    return handleAddThread(request, env, addThreadMatch[1])
  }

  // POST /api/sessions/:id/threads/:tid/messages - Add message
  const addMessageMatch = path.match(
    /^\/api\/sessions\/([a-zA-Z0-9_-]+)\/threads\/([a-zA-Z0-9_-]+)\/messages$/
  )
  if (addMessageMatch && method === "POST") {
    return handleAddMessage(request, env, addMessageMatch[1], addMessageMatch[2])
  }

  // PUT /api/sessions/:id/threads/:tid/messages/:mid - Update message
  const updateMessageMatch = path.match(
    /^\/api\/sessions\/([a-zA-Z0-9_-]+)\/threads\/([a-zA-Z0-9_-]+)\/messages\/([a-zA-Z0-9_-]+)$/
  )
  if (updateMessageMatch && method === "PUT") {
    return handleUpdateMessage(
      request,
      env,
      updateMessageMatch[1],
      updateMessageMatch[2],
      updateMessageMatch[3]
    )
  }

  // DELETE /api/sessions/:id/threads/:tid/messages - Truncate thread (delete messages after X)
  const truncateThreadMatch = path.match(
    /^\/api\/sessions\/([a-zA-Z0-9_-]+)\/threads\/([a-zA-Z0-9_-]+)\/messages$/
  )
  if (truncateThreadMatch && method === "DELETE") {
    return handleTruncateThread(request, env, truncateThreadMatch[1], truncateThreadMatch[2])
  }

  // POST /api/sessions/:id/fork - Fork session
  const forkMatch = path.match(/^\/api\/sessions\/([a-zA-Z0-9_-]+)\/fork$/)
  if (forkMatch && method === "POST") {
    return handleForkSession(env, forkMatch[1])
  }

  return errorResponse("Not found", 404)
}

const ONE_DAY = 60 * 60 * 24

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Lightweight health check
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 })
    }

    // API routes
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env, url)
    }

    // Serve built assets (SPA fallback handled via wrangler.toml)
    const res = await env.ASSETS.fetch(request)

    // Add simple cache hint for static assets
    if (res.status === 200 && res.headers.get("content-type")?.startsWith("text/")) {
      const headers = new Headers(res.headers)
      headers.set("Cache-Control", `public, max-age=${ONE_DAY}`)
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      })
    }

    return res
  },
}
