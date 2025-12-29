<div align="center">
<img width="1200" height="475" alt="GHBanner" src="public/guide-start-view.png" />

# Threaded

**A contextual AI reader for deep document exploration**

[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple)](https://vitejs.dev/)

[Quick Start](#quick-start) · [Usage](#how-to-use) · [Development](#development) · [Architecture](#architecture)

</div>

---

## Table of Contents

- [What is Threaded?](#what-is-threaded)
- [Quick Start](#quick-start)
- [Supported AI Providers](#supported-ai-providers)
- [How to Use](#how-to-use)
- [CLI](#cli)
- [Development](#development)
- [Deployment](#deploy-to-cloudflare-workers)
- [Architecture](#architecture)
- [License](#license)

---

## What is Threaded?

Threaded is a reading interface designed for deep document analysis. It replaces linear chat interfaces with focused, side-by-side conversations anchored directly to the text.

- **Contextual Threads**: Highlight any text to start a discussion or get an explanation.
- **Deep Exploration**: Branch into multiple side-conversations without losing your place in the original document.
- **AI Agnostic**: Support for Gemini, OpenAI, Anthropic, and local models via Ollama.
- **Privacy First**: All API keys and session metadata are stored in your browser.

---

## Quick Start

**Prerequisites:** Node.js 18+, [pnpm](https://pnpm.io/)

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Supported AI Providers

Configure your provider in the Settings modal:

| Provider          | Default Model                    | Notes                          |
| ----------------- | -------------------------------- | ------------------------------ |
| **Google Gemini** | gemini-3-flash-preview           | Default; best cost/perf        |
| **OpenAI**        | gpt-5.2-chat-latest              | Full support for custom bases  |
| **Anthropic**     | claude-opus-4-5-20251101         | High quality, browser-direct   |
| **Ollama**        | qwen3:8b                         | Local inference on port 11434  |

> API keys are stored only in your browser's `localStorage`.

---

## How to Use

1. **Paste markdown content** on the start screen (or use the default example).
2. **Highlight any text** to see the action tooltip:
   - **Discuss** — Start an open-ended conversation about the selection.
   - **Explain** — Get a simplified explanation immediately.
3. **Use the floating input** at the bottom to ask questions about the entire document.
4. **Export** the document with all conversations as markdown.

---

## CLI

Open local files directly from your terminal:

```bash
bun install -g @andypai/threaded
threaded ./document.pdf
```

Useful for AI agent workflows—pipe plans or code context into Threaded for deeper analysis.

See [cli/README.md](cli/README.md) for installation options and full documentation.

---

## Development

### Frontend Only

```bash
pnpm dev      # Start Vite dev server at http://localhost:3000
```

### Full Stack (with Cloudflare Worker)

```bash
pnpm dev:full    # Starts both Worker and Vite dev server
```

Or run them separately:

```bash
# Terminal 1: Worker
pnpm dev:cf

# Terminal 2: Vite (proxies /api to Worker)
pnpm dev
```

### CLI Utility

Open local files directly from your terminal:

```bash
pnpm cli -- ./your-document.pdf
```

#### Prerequisites

1. **Cloudflare Authentication** — Run `pnpm wrangler login`.
2. **Local Secrets** — Create `.dev.vars` from the example.
3. **D1 Database Setup** — Create the D1 database and apply the schema:

   ```bash
   pnpm wrangler d1 create threaded-db
   pnpm wrangler d1 execute threaded-db --local --file=migrations/schema.sql
   ```

   Update the `database_id` in both `wrangler.toml` and `wrangler.dev.toml` with the ID returned from the create command.

---

## Deploy to Cloudflare Workers

```bash
pnpm deploy:cf
```

**What happens:**

- `pnpm build` creates the static bundle in `dist/`.
- `wrangler` uploads `dist/` via the `ASSETS` binding and deploys the worker.

---

## Architecture

Threaded is built as a Cloudflare Worker that serves both a React SPA and a JSON API.

### Project Structure

```text
├── App.tsx                  # State hub & view router
├── cli/                     # CLI tool for opening local files
├── components/              # UI components (ThreadPanel, Tooltip, etc.)
├── docs/                    # Architecture documentation
├── examples/                # Example markdown files
├── hooks/                   # React hooks (useSession, useAiRequest)
├── lib/                     # Utilities (API client, formatters)
├── migrations/              # D1 database schema
├── services/                # AI service & content parser
└── worker/                  # Cloudflare Worker backend
    ├── routes/              # API endpoints
    └── utils/               # Parsing & validation
```

### API Endpoints

- `POST /api/parse`: Convert files/URLs to markdown.
- `POST /api/sessions`: Create new shared sessions.
- `GET/DELETE /api/sessions/:id`: Manage session data.
- `POST /api/sessions/:id/threads`: Anchor new conversations.
- `POST /api/sessions/:id/fork`: Clone a session.

---

## License

MIT
