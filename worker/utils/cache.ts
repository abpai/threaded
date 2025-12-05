import type { D1Database } from "@cloudflare/workers-types"
import { fixMalformedTables } from "./markdown"

/**
 * Generate SHA-256 hash of content using Web Crypto API
 */
export async function hashContent(content: ArrayBuffer | string): Promise<string> {
  const data =
    typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content)

  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Look up cached parse result by content hash
 */
export async function getCachedParse(db: D1Database, contentHash: string): Promise<string | null> {
  const result = await db
    .prepare("SELECT markdown FROM parse_cache WHERE content_hash = ?")
    .bind(contentHash)
    .first<{ markdown: string }>()

  return result?.markdown ?? null
}

/**
 * Store parse result in cache
 */
export async function setCachedParse(
  db: D1Database,
  contentHash: string,
  markdown: string,
  sourceType: "file" | "url",
  originalName: string,
  fileSize?: number
): Promise<void> {
  const now = Date.now()

  await db
    .prepare(
      `INSERT INTO parse_cache (content_hash, markdown, source_type, original_filename, file_size, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (content_hash) DO NOTHING`
    )
    .bind(contentHash, markdown, sourceType, originalName, fileSize ?? null, now)
    .run()
}

interface ParseWithCacheOptions {
  filename?: string
  fileSize?: number
  url?: string
}

export async function parseWithCache(
  db: D1Database,
  contentKey: string | ArrayBuffer,
  source: "file" | "url",
  parser: () => Promise<string>,
  options: ParseWithCacheOptions = {}
): Promise<{ markdown: string; cached: boolean }> {
  const contentHash = await hashContent(contentKey)

  const cachedMarkdown = await getCachedParse(db, contentHash)
  if (cachedMarkdown) {
    return { markdown: fixMalformedTables(cachedMarkdown), cached: true }
  }

  const rawMarkdown = await parser()
  if (!rawMarkdown.trim()) {
    throw new Error(`Could not extract content from ${source}`)
  }

  const markdown = fixMalformedTables(rawMarkdown)

  const originalName = options.filename || options.url || "unknown"
  await setCachedParse(db, contentHash, markdown, source, originalName, options.fileSize)

  return { markdown, cached: false }
}
