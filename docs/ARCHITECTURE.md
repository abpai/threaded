# Threaded Architecture

Threaded is a contextual AI reader built as a full-stack application with three main components: a React SPA (UI), a Cloudflare Worker backend, and a Bun-based CLI tool.

## Overview

Threaded enables deep document exploration through contextual conversations anchored directly to text selections. Users can highlight any text to start discussions, get explanations, or ask questions about the entire document.

## System Architecture

```plaintext
┌─────────────────────────────────────────────────────────────┐
│                         Browser (Client)                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              React SPA (UI)                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │  │
│  │  │ Components│  │  Hooks   │  │ Services │          │  │
│  │  └──────────┘  └──────────┘  └──────────┘          │  │
│  │       │              │              │                │  │
│  │       └──────────────┼──────────────┘                │  │
│  │                      │                                │  │
│  └──────────────────────┼────────────────────────────────┘  │
│                         │                                     │
│                         │ REST API                            │
│                         │ (JSON)                              │
└─────────────────────────┼─────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Worker (Backend)                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │  │
│  │  │  Routes  │  │   Auth   │  │  Utils    │          │  │
│  │  └──────────┘  └──────────┘  └──────────┘          │  │
│  │       │              │              │                │  │
│  │       └──────────────┼──────────────┘                │  │
│  └──────────────────────┼────────────────────────────────┘  │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Cloudflare D1 (SQLite)                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ Sessions │  │ Threads  │  │ Messages │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         External Services                             │   │
│  │  ┌──────────┐  ┌──────────┐                         │   │
│  │  │ Datalab  │  │   Jina   │                         │   │
│  │  │  (Files) │  │  (URLs)  │                         │   │
│  │  └──────────┘  └──────────┘                         │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
                          ▲
                          │
                          │ REST API
┌─────────────────────────┼─────────────────────────────────────┐
│                    CLI Tool (Bun)                             │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  1. Read File                                         │    │
│  │  2. Parse (if needed)                                │    │
│  │  3. Create Session                                    │    │
│  │  4. Open Browser                                      │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Component Overview

### 1. UI (React SPA)

**Location**: Root directory (`App.tsx`, `components/`, `hooks/`, `services/`)

**Purpose**: Client-side application for reading documents and managing conversations.

**Key Features**:

- Document rendering with markdown support
- Text selection and thread creation
- Real-time AI streaming responses
- Session management and history
- Dark mode and settings

**Technology**: React 19, TypeScript, Vite, Tailwind CSS

**Documentation**: [UI Architecture](./UI.md)

### 2. Worker (Cloudflare Backend)

**Location**: `worker/` directory

**Purpose**: REST API server and static asset host.

**Key Features**:

- Session CRUD operations
- Thread and message management
- File/URL parsing (via external APIs)
- Authentication via owner tokens
- Database persistence (D1)

**Technology**: Cloudflare Workers, D1 (SQLite), TypeScript

**Documentation**: [Worker Architecture](./WORKER.md)

### 3. CLI (Bun Tool)

**Location**: `cli/` directory

**Purpose**: Command-line utility for opening local files.

**Key Features**:

- File reading and parsing
- Session creation
- Browser opening

**Technology**: Bun, Commander.js, TypeScript

**Documentation**: [CLI Architecture](./CLI.md)

## Data Flow

### Creating a Session

```plaintext
User → StartView → Create Session API → D1 Database
                                    ↓
                              Return sessionId
                                    ↓
                          Update URL → Load Session
```

### Creating a Thread

```plaintext
User Selects Text → Tooltip → Create Thread (optimistic)
                                    ↓
                          Save to API → Update ID
                                    ↓
                          Stream AI Response → Update UI
```

### Forking a Shared Session

```plaintext
User Opens Shared URL → No Owner Token → Try to Edit
                                              ↓
                                    Fork Session API
                                              ↓
                                    Create New Session
                                              ↓
                                    Update URL & Ownership
```

## Technology Stack

### Frontend

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **AI SDK** - AI provider abstraction (OpenAI, Anthropic, Google, Ollama)
- **react-markdown** - Markdown rendering
- **KaTeX** - Math rendering
- **Highlight.js** - Code syntax highlighting

### Backend

- **Cloudflare Workers** - Serverless runtime
- **Cloudflare D1** - SQLite database
- **Datalab API** - File parsing (PDF, DOCX, etc.)
- **Jina AI Reader** - URL parsing

### CLI

- **Bun** - Runtime
- **Commander.js** - CLI framework
- **open** - Cross-platform browser opening

## Key Design Patterns

### 1. Optimistic Updates

UI updates immediately, API calls happen asynchronously. IDs may be updated after API response.

### 2. Fork-on-Write

Shared sessions are read-only. First write operation automatically creates an editable fork.

### 3. URL-Based Routing

Session ID embedded in URL path (`/sessionId`). No React Router - manual URL management.

### 4. Owner Token Authentication

Each session has an owner token stored server-side. Client stores tokens in localStorage for write operations.

### 5. Caching

Parse results cached in D1 to avoid re-parsing same content. Reduces external API costs.

## Database Schema

```plaintext
sessions
├── id (PK)
├── owner_token
├── markdown_content
├── created_at
├── updated_at
└── forked_from (FK → sessions.id)

threads
├── id (PK)
├── session_id (FK → sessions.id)
├── context
├── snippet
└── created_at

messages
├── id (PK)
├── thread_id (FK → threads.id)
├── role (user | model)
├── text
└── created_at

parse_cache
├── content_hash (PK)
├── markdown
├── source_type
├── original_filename
├── file_size
└── created_at
```

## API Endpoints

### Sessions

- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get session
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/sessions/:id/fork` - Fork session

### Threads

- `POST /api/sessions/:id/threads` - Create thread
- `DELETE /api/sessions/:id/threads/:tid` - Delete thread

### Messages

- `POST /api/sessions/:id/threads/:tid/messages` - Add message
- `PUT /api/sessions/:id/threads/:tid/messages/:mid` - Update message
- `DELETE /api/sessions/:id/threads/:tid/messages?after=:mid` - Truncate thread

### Parse

- `POST /api/parse` - Parse file or URL

## Storage

### Client-Side (localStorage)

- `threaded:sessions` - Session ownership tokens
- `threaded:settings` - AI provider settings
- `threaded:quotes` - Saved quotes
- `threaded:history` - Session history metadata
- `threaded:darkMode` - Dark mode preference
- `threaded:currentSessionId` - Last active session

### Server-Side (D1)

- Sessions, threads, messages
- Parse cache

## Security

### Authentication

- Owner tokens (32-char nanoids) stored server-side
- Tokens sent via `X-Owner-Token` header for write operations
- Timing-safe token comparison prevents enumeration attacks

### Authorization

- Read operations: Public (no authentication)
- Write operations: Owner token required
- Fork operations: Public (anyone can fork)

### Input Validation

- All inputs validated and trimmed
- Length limits enforced (prevents DoS)
- SQL injection prevented via parameterized queries
- File size limits (10MB max)

## Deployment

### Development

```bash
pnpm dev          # Vite dev server (port 3000)
pnpm dev:worker   # Worker dev server (port 8787)
pnpm dev:full     # Both servers
```

### Production

```bash
pnpm build        # Build SPA
pnpm deploy:cf    # Deploy Worker + assets
```

### Database

```bash
wrangler d1 create threaded-db
wrangler d1 execute threaded-db --file=migrations/0001_schema.sql
wrangler d1 execute threaded-db --file=migrations/0002_parse_cache.sql
```

## Documentation

- **[UI Architecture](./UI.md)** - React SPA structure, hooks, components, state management
- **[Worker Architecture](./worker-architecture.md)** - Cloudflare Worker routes, authentication, database
- **[CLI Architecture](./cli-architecture.md)** - Bun CLI tool for file opening

## Project Structure

```plaintext
threaded/
├── App.tsx                 # Main app component
├── index.tsx               # React entry point
├── components/             # React components
├── hooks/                  # React hooks
├── services/               # Business logic services
├── lib/                    # Utilities (API client, thread anchors)
├── worker/                 # Cloudflare Worker backend
│   ├── index.ts            # Worker entry point
│   ├── routes/             # API route handlers
│   ├── middleware/         # Auth middleware
│   └── utils/              # Worker utilities
├── cli/                    # CLI tool
│   └── src/index.ts        # CLI entry point
├── migrations/             # D1 database migrations
└── docs/                   # Architecture documentation
```

## External Dependencies

### AI Providers

- **OpenAI** - GPT models (supports custom base URLs)
- **Anthropic** - Claude models (browser-direct)
- **Google** - Gemini models
- **Ollama** - Local models (localhost:11434)

### Parsing Services

- **Datalab API** - File parsing (PDF, DOCX, XLSX, PPTX, EPUB, CSV, HTML, XML)
- **Jina AI Reader** - URL parsing

## Performance Considerations

### Client-Side

- Code splitting (katex, highlight, markdown, ai-sdk, icons)
- Lazy loading for `MarkdownRenderer`
- Optimistic updates for instant UI feedback

### Server-Side

- Parse caching reduces external API calls
- Indexed database queries
- Parameterized queries for safety and performance

## Limitations

### File Size

- Max 10MB for file uploads
- Max 500KB for markdown content
- Max 50KB for context/messages

### Network

- Requires internet connection
- No offline mode
- External API dependencies (Datalab, Jina)

### Browser Support

- Modern browsers with ES6+ support
- localStorage required
- Web Crypto API for hashing (Worker)

## Future Enhancements

### Potential Features

- Rate limiting (Durable Objects or KV)
- WebSocket support for real-time collaboration
- Export to various formats (PDF, DOCX)
- Plugin system for custom parsers
- Mobile app (React Native)
- Offline mode with IndexedDB
- Advanced search across sessions
- Thread templates
- AI model fine-tuning
