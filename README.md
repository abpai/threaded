<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Threaded

**A contextual AI reader for deep document exploration**

[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple)](https://vitejs.dev/)

</div>

## What is Threaded?

Threaded is a Medium-style reading interface that lets you have AI-powered side conversations about any part of a document. Instead of linear chat interfaces that lose context, Threaded lets you:

- **Highlight any text** to start a focused discussion thread
- **Branch conversations** without losing your place in the document
- **Ask questions about the whole document** via the floating input bar
- **Export conversations** alongside the original content

## Quick Start

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Supported AI Providers

Configure your preferred provider in the Settings modal:

| Provider | Default Model | Notes |
|----------|--------------|-------|
| **Google Gemini** | gemini-2.5-flash | Default provider |
| **OpenAI** | gpt-4o | Supports custom base URLs |
| **Anthropic** | claude-3-haiku | Requires browser CORS header |

API keys are stored locally in your browser's localStorage.

## How to Use

1. **Paste markdown content** on the start screen (or use the default example)
2. **Click "Start Reading"** to enter the formatted reading view
3. **Highlight any text** to see the action tooltip:
   - **Discuss** - Start an open-ended conversation about the selection
   - **Explain** - Get a simplified explanation immediately
4. **Use the floating input** at the bottom to ask questions about the entire document
5. **Click "X active threads"** to see all your conversations

## Features

- **Dark mode** - Toggle via the moon/sun icon
- **Markdown rendering** - Full support including code blocks, math (KaTeX), and syntax highlighting
- **Thread history** - All conversations preserved during your session
- **Export** - Download the document with all thread discussions as markdown

## Development

```bash
npm run dev      # Start dev server with hot reload
npm run build    # Build for production
npm run preview  # Preview production build
```

## Deploy to Cloudflare Workers

This repository ships a Workers runtime so you can deploy the Vite-built SPA directly to Cloudflare's edge.

Prerequisites:
- Cloudflare account with Workers enabled
- `wrangler` auth (`npx wrangler login`) and a production API token with `Workers Deploy` + `Workers Scripts` permissions

Deploy:
```bash
# Build and upload assets + worker
npm run deploy:cf
```

What happens:
- `npm run build` creates the static bundle in `dist/`
- `wrangler` uploads `dist/` via the `ASSETS` binding and deploys `worker.ts`
- SPA routing is handled automatically (`not_found_handling = "single-page-application"` in `wrangler.toml`)

Local edge preview:
```bash
npm run dev:cf   # serves the worker and built assets at http://localhost:8787
```

## Project Structure

```
├── App.tsx              # Main app component and state
├── types.ts             # TypeScript interfaces
├── components/
│   ├── ThreadPanel.tsx  # Individual thread conversation
│   ├── ThreadList.tsx   # Sidebar listing all threads
│   ├── Tooltip.tsx      # Text selection action menu
│   └── SettingsModal.tsx# Provider/model configuration
└── services/
    └── aiService.ts     # Multi-provider AI integration
```

## License

MIT
