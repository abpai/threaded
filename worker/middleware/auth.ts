import type { Env } from '../types'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  let result = 0
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i]
  }
  return result === 0
}

export async function verifyOwnerToken(
  env: Env,
  sessionId: string,
  token: string | null
): Promise<boolean> {
  if (!token) return false
  const result = await env.DB.prepare('SELECT owner_token FROM sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ owner_token: string }>()
  if (!result?.owner_token) return false
  return timingSafeEqual(result.owner_token, token)
}
