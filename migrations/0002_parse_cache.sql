-- Parse cache table for avoiding duplicate Datalab API charges
-- Run with: npx wrangler d1 execute threaded-db --file=migrations/0002_parse_cache.sql

CREATE TABLE IF NOT EXISTS parse_cache (
  content_hash TEXT PRIMARY KEY,
  markdown TEXT NOT NULL,
  source_type TEXT NOT NULL,
  original_filename TEXT,
  file_size INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parse_cache_created ON parse_cache(created_at);
