# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Threaded is a contextual AI reader - a Medium-style document interface where users can highlight text and branch into side-conversations with AI. Users paste markdown content, read it in a formatted view, and create discussion threads about specific sections or the entire document.

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server on port 3000
npm run build      # Production build with Vite
npm run preview    # Preview production build
```

## Environment Setup

API keys are configured through the in-app settings modal. Users can set their API keys for Google Gemini, OpenAI, Anthropic, or Ollama providers.

## Architecture

### Core Flow

1. **Start View** (`ViewState.START`): User pastes markdown content
2. **Reading View** (`ViewState.READING`): Formatted document with text selection capabilities
3. **Thread Creation**: Highlight text → tooltip appears → "Discuss" or "Explain" creates a thread in the sidebar

### Key Components

- **App.tsx**: Main application state and routing between views. Manages threads, settings, dark mode, and text selection handling
- **ThreadPanel.tsx**: Individual thread conversation UI with chat input
- **ThreadList.tsx**: Sidebar showing all active threads sorted by recent activity
- **Tooltip.tsx**: Floating menu that appears on text selection with "Discuss", "Explain", and copy options
- **SettingsModal.tsx**: Provider/model configuration with API key storage in localStorage

### AI Service Layer

- **services/aiService.ts**: Active service - multi-provider support (Google, OpenAI, Anthropic) with configurable base URLs
- **services/geminiService.ts**: Legacy Gemini-only service (not currently used)

The AI service constructs different system prompts based on whether the thread is about a specific highlighted section or the entire document.

### State Management

All state is managed in `App.tsx` using React hooks:

- `threads`: Array of conversation threads
- `settings`: Provider, API key, model ID stored in localStorage under `threaded-settings`
- `selection`: Current text selection with bounding rect for tooltip positioning

### Styling

- Tailwind CSS via CDN with dark mode (`class` strategy)
- Custom markdown styling in `index.html` for the reading view
- Uses Merriweather (serif) for content and Inter (sans) for UI
- KaTeX for math rendering, highlight.js for code blocks

### Path Alias

`@/*` maps to project root (configured in tsconfig.json and vite.config.ts)
