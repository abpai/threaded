-- Threaded D1 Database Schema

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  owner_token TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  forked_from TEXT,
  FOREIGN KEY (forked_from) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  context TEXT NOT NULL,
  snippet TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT CHECK (role IN ('user', 'model')) NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parse_cache (
  content_hash TEXT PRIMARY KEY,
  markdown TEXT NOT NULL,
  source_type TEXT NOT NULL,
  original_filename TEXT,
  file_size INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_threads_session ON threads(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_threads_created ON threads(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_parse_cache_created ON parse_cache(created_at);
