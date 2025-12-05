<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

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
- [Features](#features)
- [Development](#development)
  - [Frontend Only](#frontend-only)
  - [Full Stack](#full-stack-with-cloudflare-worker)
- [Deployment](#deploy-to-cloudflare-workers)
- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Frontend Data Flow](#frontend-data-flow)
  - [Backend API Flow](#backend-api-flow)
  - [Project Structure](#project-structure)
- [License](#license)

---

## What is Threaded?

Threaded is a Medium-style reading interface that lets you have AI-powered side conversations about any part of a document. Instead of linear chat interfaces that lose context, Threaded lets you:

- **Highlight any text** to start a focused discussion thread
- **Branch conversations** without losing your place in the document
- **Ask questions about the whole document** via the floating input bar
- **Export conversations** alongside the original content

---

## Quick Start

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Supported AI Providers

Configure your preferred provider in the Settings modal:

| Provider | Default Model | Notes |
|----------|--------------|-------|
| **Google Gemini** | gemini-2.5-flash | Default provider |
| **OpenAI** | gpt-4o | Supports custom base URLs |
| **Anthropic** | claude-3-haiku | Requires browser CORS header |

> API keys are stored locally in your browser's localStorage.

---

## How to Use

1. **Paste markdown content** on the start screen (or use the default example)
2. **Click "Start Reading"** to enter the formatted reading view
3. **Highlight any text** to see the action tooltip:
   - **Discuss** — Start an open-ended conversation about the selection
   - **Explain** — Get a simplified explanation immediately
4. **Use the floating input** at the bottom to ask questions about the entire document
5. **Click "X active threads"** to see all your conversations

---

## Features

| Feature | Description |
|---------|-------------|
| **Dark mode** | Toggle via the moon/sun icon |
| **Markdown rendering** | Full support including code blocks, math (KaTeX), and syntax highlighting |
| **Thread history** | All conversations preserved during your session |
| **Export** | Download the document with all thread discussions as markdown |

---

## Development

### Frontend Only

```bash
npm run dev      # Start Vite dev server at http://localhost:3000
```

This runs the frontend with hot reload. Backend features (file parsing, URL fetching, shared sessions) require the Worker.

### Full Stack (with Cloudflare Worker)

Run both the Vite dev server and the Cloudflare Worker:

```bash
npm run dev:full    # Starts both Worker and Vite dev server
```

Or run them separately:

```bash
# Terminal 1: Worker (requires Cloudflare auth)
npm run dev:cf

# Terminal 2: Vite dev server (proxies /api to Worker)
npm run dev
```

The Vite dev server proxies `/api/*` requests to `localhost:8787`.

#### Prerequisites

1. **Cloudflare Authentication** — Run `npx wrangler login`

2. **Local Secrets** — Create `.dev.vars` from the example:

   ```bash
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your actual DATALAB_API_KEY
   ```

3. **D1 Database Setup** — Create a D1 database and run migrations:

   ```bash
   npx wrangler d1 create threaded-db
   # Copy the returned database_id into wrangler.toml

   npx wrangler d1 execute threaded-db --local --file=migrations/0001_schema.sql
   ```

### Other Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## Deploy to Cloudflare Workers

Deploy the Vite-built SPA directly to Cloudflare's edge.

### Requirements

- Cloudflare account with Workers enabled
- `wrangler` auth and a production API token with `Workers Deploy` + `Workers Scripts` permissions

### Setup Secrets

```bash
npx wrangler secret put DATALAB_API_KEY
```

### Deploy

```bash
npm run deploy:cf
```

**What happens:**

- `npm run build` creates the static bundle in `dist/`
- `wrangler` uploads `dist/` via the `ASSETS` binding and deploys the worker
- SPA routing handled via `not_found_handling = "single-page-application"` in `wrangler.toml`

### Local Edge Preview

```bash
npm run dev:cf   # Serves worker and built assets at http://localhost:8787
```

---

## Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React SPA)                           │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           App.tsx (State Hub)                        │   │
│  │    ViewState • Threads • Settings • Selection • Session              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────┐     ┌─────────────────┐    ┌──────────────┐               │
│  │   Views     │     │   Components    │    │    Hooks     │               │
│  │ ─────────── │     │ ─────────────── │    │ ──────────── │               │
│  │ StartView   │     │ ThreadPanel     │    │ useSession   │               │
│  │ QuotesView  │     │ ThreadList      │    │ useSettings  │               │
│  │ HistoryPanel│     │ Tooltip         │    │ useThreads   │               │
│  └─────────────┘     │ SettingsModal   │    │ useAiStream  │               │
│                      │ MarkdownRenderer│    │ useSelection │               │
│                      └─────────────────┘    └──────────────┘               │
│                                                    │                        │
│                                                    ▼                        │
│                              ┌──────────────────────────────────┐          │
│                              │          Services                │          │
│                              │ ──────────────────────────────── │          │
│                              │ aiService.ts    → AI Providers   │          │
│                              │ sessionHistory  → localStorage   │          │
│                              │ contentParser   → File/URL parse │          │
│                              └──────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ /api/*
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Cloudflare Worker)                          │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        worker/index.ts (Router)                      │   │
│  │   /api/sessions • /api/sessions/:id/threads • /api/parse             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────┐     ┌─────────────────┐    ┌──────────────┐               │
│  │   Routes    │     │     Utils       │    │   Bindings   │               │
│  │ ─────────── │     │ ─────────────── │    │ ──────────── │               │
│  │ sessions.ts │     │ datalab.ts      │    │ D1 Database  │               │
│  │ threads.ts  │     │ jina.ts         │    │ ASSETS       │               │
│  │ parse.ts    │     │ markdown.ts     │    │ Secrets      │               │
│  └─────────────┘     │ validation.ts   │    └──────────────┘               │
│                      └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Frontend Data Flow

```text
User Action                    State Management                  Side Effects
───────────────────────────────────────────────────────────────────────────────

                              ┌─────────────────┐
  Paste markdown    ────────► │   StartView     │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
  "Start Reading"   ────────► │ ViewState=      │ ────────► Render document
                              │ READING         │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
  Highlight text    ────────► │useTextSelection │ ────────► Show Tooltip
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              ▼                 ▼
                      ┌─────────────┐   ┌─────────────┐
  Click "Discuss" ──► │ Add Thread  │   │ Add Thread  │ ◄── Click "Explain"
                      │ (open)      │   │ + AI call   │
                      └──────┬──────┘   └──────┬──────┘
                             │                 │
                             └────────┬────────┘
                                      ▼
                              ┌─────────────────┐
                              │ useAiStreaming  │ ────────► AI Provider API
                              └────────┬────────┘           (Gemini/OpenAI/
                                       │                     Anthropic)
                                       ▼
                              ┌─────────────────┐
                              │ ThreadPanel     │ ────────► Stream response
                              │ (conversation)  │           to UI
                              └─────────────────┘
```

### Backend API Flow

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse` | POST | Parse file (via Datalab) or URL (via Jina Reader) to markdown |
| `/api/sessions` | POST | Create a new session |
| `/api/sessions/:id` | GET | Fetch session with threads and messages |
| `/api/sessions/:id` | DELETE | Delete a session |
| `/api/sessions/:id/fork` | POST | Clone session to new ID |
| `/api/sessions/:id/threads` | POST | Add thread to session |
| `/api/sessions/:id/threads/:tid/messages` | POST | Add message to thread |

### Project Structure

```text
├── App.tsx                  # Main app component and state hub
├── types.ts                 # TypeScript interfaces
│
├── components/
│   ├── StartView.tsx        # Initial markdown input view
│   ├── ThreadPanel.tsx      # Individual thread conversation UI
│   ├── ThreadList.tsx       # Sidebar listing all threads
│   ├── Tooltip.tsx          # Text selection action menu
│   ├── SettingsModal.tsx    # Provider/model configuration
│   ├── MarkdownRenderer.tsx # Document rendering with KaTeX/highlight.js
│   ├── HistoryPanel.tsx     # Session history sidebar
│   ├── QuotesView.tsx       # Saved quotes display
│   └── Dialog.tsx           # Reusable dialog component
│
├── hooks/
│   ├── useSession.ts        # Remote session sync with Worker
│   ├── useSettings.ts       # Provider/API key management
│   ├── useThreadManager.ts  # Thread CRUD operations
│   ├── useAiStreaming.ts    # AI response streaming
│   ├── useTextSelection.ts  # Text highlight detection
│   ├── useQuotes.ts         # Quote management
│   └── useDarkMode.ts       # Theme persistence
│
├── services/
│   ├── aiService.ts         # Multi-provider AI integration
│   ├── sessionHistory.ts    # localStorage session metadata
│   ├── contentParser.ts     # File/URL parsing client
│   └── prompts.ts           # AI system prompts
│
└── worker/                  # Cloudflare Worker (Backend)
    ├── index.ts             # Request router
    ├── types.ts             # Worker-specific types
    ├── routes/
    │   ├── sessions.ts      # Session CRUD handlers
    │   ├── threads.ts       # Thread/message handlers
    │   └── parse.ts         # File/URL parsing endpoint
    └── utils/
        ├── datalab.ts       # Datalab API for file parsing
        ├── jina.ts          # Jina Reader for URL parsing
        ├── markdown.ts      # Markdown utilities
        └── validation.ts    # Request validation
```

---

## License

MIT
