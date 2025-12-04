export interface Env {
  ASSETS: Fetcher
}

const ONE_DAY = 60 * 60 * 24

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Lightweight health check
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 })
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
