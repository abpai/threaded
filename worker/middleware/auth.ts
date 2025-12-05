import type { Env } from "../types"

export async function verifyOwnerToken(
  env: Env,
  sessionId: string,
  token: string | null
): Promise<boolean> {
  if (!token) return false
  const result = await env.DB.prepare("SELECT owner_token FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first<{ owner_token: string }>()
  return result?.owner_token === token
}
