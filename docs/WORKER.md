# Worker Architecture

Threaded's backend is a Cloudflare Worker that serves both the React SPA and a REST API. It uses Cloudflare D1 (SQLite) for persistence and integrates with external services for file parsing.

## Overview

The Worker is a single-file entry point (`worker/index.ts`) that routes requests to handler functions in `worker/routes/`. It serves static assets via the `ASSETS` binding and handles API requests with authentication and validation.

## Entry Point (`worker/index.ts`)

### Request Flow
1. **Health check** (`/health`) → returns `"ok"` (200)
2. **API routes** (`/api/*`) → routed to handlers in `worker/routes/`
3. **Static assets** → served via `ASSETS` binding with cache headers

### CORS Handling
- All API responses include CORS headers (`Access-Control-Allow-Origin: *`)
- OPTIONS requests return CORS headers immediately (preflight)
- Headers defined in `worker/utils/response.ts`

### Asset Serving
- `ASSETS.fetch(request)` serves files from `dist/` directory
- SPA fallback: `not_found_handling = "single-page-application"` in `wrangler.toml`
- Cache headers: `public, max-age=86400` (1 day) for text content types

## Route Handlers (`worker/routes/`)

### Sessions (`sessions.ts`)

#### POST `/api/sessions`
**Purpose**: Creates new session

**Request Body**:
```json
{
  "markdownContent": string
}
```

**Process**:
1. Validates `markdownContent` (max 500KB, non-empty string)
2. Generates `sessionId` (21-char nanoid)
3. Generates `ownerToken` (32-char nanoid)
4. Inserts into `sessions` table with timestamps
5. Returns `{ sessionId, ownerToken }` (201)

**Validation**: Uses `validateString()` from `worker/utils/validation.ts`

#### GET `/api/sessions/:id`
**Purpose**: Retrieves session with all threads and messages

**Authentication**: None (public read)

**Process**:
1. Queries `sessions` table for session
2. Returns 404 if not found
3. Queries `threads` table for all threads in session
4. For each thread, queries `messages` table
5. Assembles nested response structure
6. Returns full session object (200)

**Response Structure**:
```json
{
  "id": string,
  "markdownContent": string,
  "createdAt": number,
  "updatedAt": number,
  "forkedFrom": string | null,
  "threads": [{
    "id": string,
    "context": string,
    "snippet": string,
    "createdAt": number,
    "messages": [{
      "id": string,
      "role": "user" | "model",
      "text": string,
      "timestamp": number
    }]
  }]
}
```

**Note**: Owner token is never included in GET responses (security)

#### DELETE `/api/sessions/:id`
**Purpose**: Deletes session (owner only)

**Authentication**: Requires `X-Owner-Token` header

**Process**:
1. Extracts `X-Owner-Token` header
2. Verifies token via `verifyOwnerToken()`
3. Returns 403 if invalid
4. Deletes session (CASCADE deletes threads and messages)
5. Returns `{ success: true }` (200)

#### POST `/api/sessions/:id/fork`
**Purpose**: Creates editable copy of session

**Authentication**: None (anyone can fork)

**Process**:
1. Queries original session
2. Returns 404 if not found
3. Creates new session with:
   - New `sessionId` (21-char nanoid)
   - New `ownerToken` (32-char nanoid)
   - Copied `markdown_content`
   - `forked_from` set to original session ID
4. Copies all threads:
   - Creates new thread IDs
   - Maintains `threadIdMap` for ID mapping
   - Preserves `context`, `snippet`, `created_at`
5. Copies all messages for each thread:
   - Creates new message IDs
   - Preserves `role`, `text`, `created_at`
6. Returns `{ sessionId, ownerToken, threadIdMap }` (201)

**Use Case**: Allows non-owners to create editable copies of shared sessions

### Threads (`threads.ts`)

#### POST `/api/sessions/:id/threads`
**Purpose**: Creates new thread in session

**Authentication**: Requires `X-Owner-Token` header

**Request Body**:
```json
{
  "context": string,  // Selected text (max 50KB)
  "snippet": string   // Preview text (max 1KB)
}
```

**Process**:
1. Verifies owner token
2. Validates `context` and `snippet` (length limits)
3. Generates `threadId` (21-char nanoid)
4. Inserts into `threads` table
5. Updates session `updated_at` timestamp
6. Returns `{ threadId, createdAt }` (201)

#### DELETE `/api/sessions/:id/threads/:tid`
**Purpose**: Deletes thread and all messages

**Authentication**: Requires `X-Owner-Token` header

**Process**:
1. Verifies owner token
2. Verifies thread belongs to session
3. Deletes all messages in thread (explicit, not relying on CASCADE)
4. Deletes thread
5. Updates session `updated_at` timestamp
6. Returns `{ success: true }` (200)

### Messages (`threads.ts`)

#### POST `/api/sessions/:id/threads/:tid/messages`
**Purpose**: Adds message to thread

**Authentication**: Requires `X-Owner-Token` header

**Request Body**:
```json
{
  "role": "user" | "model",
  "text": string  // Max 50KB
}
```

**Process**:
1. Verifies owner token
2. Verifies thread belongs to session
3. Validates `role` (must be "user" or "model")
4. Validates `text` (non-empty, max 50KB)
5. Generates `messageId` (21-char nanoid)
6. Inserts into `messages` table
7. Updates session `updated_at` timestamp
8. Returns `{ messageId, timestamp }` (201)

**Note**: Backend uses "model" role, frontend uses "assistant" (converted in `useSession.ts`)

#### PUT `/api/sessions/:id/threads/:tid/messages/:mid`
**Purpose**: Updates message text

**Authentication**: Requires `X-Owner-Token` header

**Request Body**:
```json
{
  "text": string  // Max 50KB
}
```

**Process**:
1. Verifies owner token
2. Verifies message exists and belongs to thread/session
3. Validates `text` (non-empty, max 50KB)
4. Updates message `text` field
5. Updates session `updated_at` timestamp
6. Returns `{ success: true, timestamp }` (200)

#### DELETE `/api/sessions/:id/threads/:tid/messages?after=:mid`
**Purpose**: Truncates thread (removes messages after point)

**Authentication**: Requires `X-Owner-Token` header

**Query Parameters**:
- `after` - Message ID to truncate after (required)

**Process**:
1. Verifies owner token
2. Verifies thread belongs to session
3. Verifies message exists in thread
4. Deletes all messages after specified message:
   - Uses `created_at` timestamp for ordering
   - Handles tie-breaking via ID comparison
5. Updates session `updated_at` timestamp
6. Returns `{ success: true }` (200)

**Use Case**: "Regenerate" functionality - removes AI response and regenerates

### Parse (`parse.ts`)

#### POST `/api/parse`
**Purpose**: Parses files or URLs to markdown

**Two Request Types**:

**1. File Upload** (`multipart/form-data`):
- Content-Type: `multipart/form-data`
- Body: FormData with `file` field
- File size limit: 10MB
- Supported extensions: `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.epub`, `.csv`, `.html`, `.xml`
- Direct text files (`.md`, `.txt`) read directly, no parsing needed

**2. URL Parse** (`application/json`):
- Content-Type: `application/json`
- Body: `{ "url": string }`
- URL must be valid (parsed via `new URL()`)

**Process**:
1. Determines request type from Content-Type header
2. **File Upload**:
   - Extracts file from FormData
   - Validates file size (max 10MB)
   - Checks extension
   - For `.md`/`.txt`: reads directly, fixes malformed tables
   - For other types: calls `parseWithCache()` → `parseWithDatalab()`
3. **URL Parse**:
   - Validates URL format
   - Calls `parseWithCache()` → `parseUrlWithJina()`
4. Returns `{ markdown: string, source: "file" | "url", cached?: boolean }` (200)

**Caching**: Uses `parse_cache` table to avoid re-parsing same content (see Cache section)

**External Services**:
- **Datalab API**: File parsing (requires `DATALAB_API_KEY`)
- **Jina AI Reader**: URL parsing (requires `JINA_API_KEY`)

## Authentication (`worker/middleware/auth.ts`)

### Owner Token System
- Each session has an `owner_token` (32-char nanoid)
- Stored in D1 `sessions` table, never exposed in GET requests
- Sent via `X-Owner-Token` header for write operations
- Client stores tokens in localStorage (see UI Architecture)

### `verifyOwnerToken()`
**Purpose**: Verifies owner token matches session

**Process**:
1. Queries `sessions` table for `owner_token`
2. Returns `false` if session not found or token missing
3. Uses timing-safe comparison (`timingSafeEqual()`) to prevent timing attacks
4. Returns `true` if token matches, `false` otherwise

**Security**: Timing-safe comparison prevents token enumeration attacks

### Usage
- Called by all write operation handlers
- Returns 403 Forbidden if token invalid
- No authentication required for reads (GET endpoints)

## Database Schema (D1)

### `sessions` Table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                    -- 21-char nanoid
  owner_token TEXT NOT NULL,              -- 32-char nanoid
  markdown_content TEXT NOT NULL,         -- Max 500KB
  created_at INTEGER NOT NULL,           -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL,            -- Unix timestamp (ms)
  forked_from TEXT,                       -- References sessions(id)
  FOREIGN KEY (forked_from) REFERENCES sessions(id) ON DELETE SET NULL
);
```

**Indexes**:
- Primary key on `id` (automatic)

### `threads` Table
```sql
CREATE TABLE threads (
  id TEXT PRIMARY KEY,                    -- 21-char nanoid
  session_id TEXT NOT NULL,               -- References sessions(id)
  context TEXT NOT NULL,                   -- Selected text (max 50KB)
  snippet TEXT NOT NULL,                   -- Preview text (max 1KB)
  created_at INTEGER NOT NULL,             -- Unix timestamp (ms)
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_threads_session` on `session_id`
- `idx_threads_created` on `(session_id, created_at)` - For ordering

### `messages` Table
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,                    -- 21-char nanoid
  thread_id TEXT NOT NULL,                -- References threads(id)
  role TEXT CHECK (role IN ('user', 'model')) NOT NULL,
  text TEXT NOT NULL,                     -- Max 50KB
  created_at INTEGER NOT NULL,             -- Unix timestamp (ms)
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_messages_thread` on `thread_id`
- `idx_messages_created` on `(thread_id, created_at)` - For ordering

### `parse_cache` Table
```sql
CREATE TABLE parse_cache (
  content_hash TEXT PRIMARY KEY,          -- SHA-256 hash
  markdown TEXT NOT NULL,
  source_type TEXT NOT NULL,              -- "file" | "url"
  original_filename TEXT,
  file_size INTEGER,
  created_at INTEGER NOT NULL
);
```

**Indexes**:
- `idx_parse_cache_created` on `created_at` - For cleanup queries

**Purpose**: Caches parsed content to avoid re-parsing same files/URLs

## Utilities (`worker/utils/`)

### `nanoid.ts`
**Purpose**: Generates URL-safe IDs

**Implementation**: Uses Cloudflare's Web Crypto API (`crypto.getRandomValues()`)

**Usage**:
- 21 chars for session/thread/message IDs
- 32 chars for owner tokens

**Algorithm**: Custom implementation using URL-safe characters (A-Za-z0-9_-)

### `response.ts`
**Purpose**: Standardized response helpers

**Functions**:
- `jsonResponse(data, status)` - JSON response with CORS headers
- `errorResponse(message, status)` - Error response with CORS headers
- `corsHeaders` - Standard CORS headers object

**CORS Headers**:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Owner-Token
```

### `validation.ts`
**Purpose**: Input validation and sanitization

**Constants**:
- `LIMITS.markdownContent`: 500KB
- `LIMITS.context`: 50KB
- `LIMITS.snippet`: 1KB
- `LIMITS.text`: 50KB
- `MAX_FILE_SIZE`: 10MB

**Functions**:
- `validateString(value, maxLength, fieldName)` - Validates and trims strings
  - Checks type is string
  - Trims whitespace
  - Validates non-empty
  - Validates max length
  - Throws Error with descriptive message

### `cache.ts` (83 lines)
**Purpose**: Parse result caching

**Functions**:
- `hashContent(content)` - Generates SHA-256 hash of content
  - Supports `ArrayBuffer` (files) or `string` (URLs)
  - Uses Web Crypto API
  - Returns hex string
- `getCachedParse(db, contentHash)` - Looks up cached result
- `setCachedParse(db, contentHash, markdown, ...)` - Stores result
- `parseWithCache(db, contentKey, source, parser, options)` - Main caching function
  1. Hashes content key
  2. Checks cache
  3. Returns cached if found
  4. Otherwise calls parser function
  5. Stores result in cache
  6. Returns parsed result

**Cache Key**: SHA-256 hash of file content or URL string

**Benefits**: Reduces external API calls and costs

### `datalab.ts`
**Purpose**: File parsing via Datalab API

**Function**: `parseWithDatalab(fileBlob, filename, apiKey)`

**Process**:
1. Creates FormData with file
2. POSTs to Datalab API endpoint
3. Extracts markdown from response
4. Returns markdown string

**Supported Formats**: PDF, DOCX, XLSX, PPTX, EPUB, CSV, HTML, XML

**Error Handling**: Throws Error with API error message

### `jina.ts`
**Purpose**: URL parsing via Jina AI Reader API

**Function**: `parseUrlWithJina(url, apiKey)`

**Process**:
1. POSTs URL to Jina API endpoint
2. Extracts markdown from response
3. Returns markdown string

**Error Handling**: Throws Error with API error message

### `markdown.ts`
**Purpose**: Markdown processing utilities

**Function**: `fixMalformedTables(markdown)`

**Purpose**: Fixes broken markdown tables from parsed content

**Implementation**: Regex-based table fixing (handles edge cases)

## Environment Variables

### Required
- `DATALAB_API_KEY` - For file parsing (Datalab API)
- `JINA_API_KEY` - For URL parsing (Jina AI Reader API)

### D1 Binding
- `DB` - D1 database instance (configured in `wrangler.toml`)
  - Database name: `threaded-db`
  - Binding name: `DB`

### Assets Binding
- `ASSETS` - Static asset serving (configured in `wrangler.toml`)
  - Directory: `dist`
  - SPA fallback enabled

## Error Handling

### Validation Errors
- **400 Bad Request** - Invalid input (missing fields, wrong types, length limits)
- Response: `{ error: "descriptive message" }`

### Authentication Errors
- **403 Forbidden** - Invalid or missing owner token
- Response: `{ error: "Forbidden" }`

### Not Found Errors
- **404 Not Found** - Session/thread/message not found
- Response: `{ error: "Not found" }` or `{ error: "Session not found" }`

### Server Errors
- **500 Internal Server Error** - Unexpected errors (database failures, external API errors)
- Logged to console via `console.error()`
- Response: `{ error: "Failed to ..." }` (generic message)

### Error Response Format
All errors follow consistent format:
```json
{
  "error": "Error message"
}
```

## Caching Strategy

### Parse Cache
- **Key**: SHA-256 hash of file content or URL string
- **Storage**: D1 `parse_cache` table
- **TTL**: None (manual cleanup via migration)
- **Benefits**: Reduces external API calls and costs
- **Cache Hit**: Returns cached markdown immediately
- **Cache Miss**: Calls parser, stores result, returns markdown

### Static Assets
- **Cache-Control**: `public, max-age=86400` (1 day)
- **Scope**: Only for text content types (HTML, CSS, JS)
- **Served via**: `ASSETS` binding

## Security Considerations

### Owner Token Storage
- Tokens stored server-side only (D1 database)
- Never exposed in GET responses
- Client must store tokens securely (localStorage)
- Timing-safe comparison prevents enumeration attacks

### Input Validation
- All inputs validated and trimmed
- Length limits enforced (prevents DoS)
- SQL injection prevented via parameterized queries
- File size limits (10MB max)

### CORS
- CORS headers on all API responses
- Allows browser-based clients
- No authentication required for reads (public sessions)

### Rate Limiting
- Not implemented (relies on Cloudflare's default limits)
- Could be added via Durable Objects or KV if needed

### SQL Injection Prevention
- All queries use parameterized statements (`.bind()`)
- No string concatenation in SQL
- D1 API handles escaping

## Performance Considerations

### D1 Queries
- Parameterized queries for safety and performance
- Indexes on foreign keys for fast lookups
- Batch operations where possible (threads + messages)
- Could be optimized with JOINs if needed (currently separate queries)

### File Parsing
- Cached to avoid re-parsing
- Async processing (non-blocking)
- Size limits prevent memory issues (10MB)

### Session Loading
- Single query for session
- Separate queries for threads/messages (could JOIN)
- Ordered by `created_at` for consistent ordering

### Response Sizes
- Markdown content: Max 500KB
- Context: Max 50KB
- Messages: Max 50KB each
- Total session size: ~500KB + (N threads × 50KB) + (M messages × 50KB)

## Deployment

### Local Development
```bash
pnpm dev:worker  # Uses wrangler.dev.toml
```
- Runs Worker locally on `http://localhost:8787`
- Uses local D1 database (`.wrangler/state/v3/d1/`)
- Requires `.dev.vars` file for API keys

### Production
```bash
pnpm deploy:cf  # Deploys via wrangler.toml
```
- Builds SPA first (`pnpm build`)
- Deploys Worker + assets to Cloudflare
- Uses production D1 database

### Database Migrations
- Run manually via `wrangler d1 execute`
- Migrations in `migrations/` directory
- Schema versioned with timestamps (`0001_schema.sql`, `0002_parse_cache.sql`)

**Example**:
```bash
wrangler d1 execute threaded-db --file=migrations/0001_schema.sql
wrangler d1 execute threaded-db --file=migrations/0002_parse_cache.sql
```

## Configuration Files

### `wrangler.toml`
- Worker configuration
- D1 database binding
- Assets binding
- Build command

### `wrangler.dev.toml`
- Local development configuration
- Overrides for local D1
- Dev server settings

