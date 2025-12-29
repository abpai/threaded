# UI Architecture

Threaded's UI is a React Single Page Application (SPA) built with TypeScript, Vite, and Tailwind CSS. The architecture follows a component-hook-service pattern with clear separation of concerns.

## Overview

The UI is a client-side application that communicates with the Cloudflare Worker backend via REST APIs. All AI provider interactions happen directly from the browser (except for file parsing, which goes through the Worker). The app uses URL-based routing where the session ID is embedded in the path (`/sessionId`).

## Entry Points

### `index.tsx`
- Mounts the React app to the DOM root element
- Wraps `App` in `ErrorBoundary` for error handling
- Imports global CSS (`index.css`)

### `App.tsx`
- **Central state hub** and view router (1087 lines)
- Manages session lifecycle, view state, and UI coordination
- Coordinates between hooks, components, and services
- Handles URL-based session routing (`/sessionId`)
- Manages thread anchor DOM manipulation
- Handles optimistic updates and API synchronization

## Component Architecture

### View Components (`components/`)

**`StartView.tsx`**
- Initial screen for pasting/uploading content
- Handles file uploads, URL parsing, and direct paste
- Shows example content option
- Integrates with settings for API key validation

**`ThreadPanel.tsx`**
- Sidebar showing active thread conversation
- Displays message history with role indicators
- Handles message editing, deletion, retry
- Shows tool invocations (web search results)
- Input field for sending messages

**`ThreadList.tsx`**
- List of all threads in a session
- Shows thread snippets and creation time
- Click to open thread in `ThreadPanel`
- Delete thread option

**`QuotesView.tsx`**
- Dedicated view for saved quotes
- Grid/list layout of saved text selections
- Delete individual quotes

**`MarkdownRenderer.tsx`**
- Renders markdown content with syntax highlighting
- Uses `react-markdown` with `rehype-highlight` and `rehype-katex`
- Supports GitHub Flavored Markdown (GFM)
- Math rendering via KaTeX
- Code syntax highlighting

### UI Components

**`Tooltip.tsx`**
- Floating action menu for text selections
- Appears above selected text with "Discuss" and "Explain" actions
- "Save Quote" button
- Positioned using `DOMRect` from selection

**`Dialog.tsx`**
- Modal dialogs with types: alert, confirm, success, error
- Handles user confirmations and notifications
- Accessible keyboard handling

**`SettingsModal.tsx`**
- AI provider configuration
- Provider selection (Google, OpenAI, Anthropic, Ollama)
- API key input (stored in localStorage)
- Base URL and model ID configuration
- Validates required fields

**`HistoryPanel.tsx`**
- Slide-out sidebar for session history
- Lists sessions from localStorage with titles and summaries
- Click to navigate to session
- Delete sessions (local + API if owner)
- New session button

**`SharedBanner.tsx`**
- Banner shown for shared (read-only) sessions
- Explains fork-on-write behavior
- Dismissible

**`ErrorBoundary.tsx`**
- React error boundary wrapper
- Catches rendering errors and displays fallback UI

**`ToolInvocationRenderer.tsx`**
- Renders AI tool invocations (web search, etc.)
- Shows tool name, arguments, and results
- Handles different tool invocation states

## Hook Architecture (`hooks/`)

Hooks encapsulate business logic and state management, following React's hooks pattern.

### `useSession.ts` (343 lines)
**Purpose**: Manages session data and API synchronization

**Features**:
- Loads session data from API via `api.getSession()`
- Handles ownership tokens (stored in localStorage under `threaded:sessions`)
- Auto-forks shared sessions when user tries to edit
- Provides CRUD operations for threads and messages
- Tracks save state (idle, saving, error)

**Key Functions**:
- `addThread(context, snippet)` - Creates new thread (auto-forks if needed)
- `addMessage(threadId, role, text)` - Adds message to thread (auto-forks if needed)
- `updateMessage(threadId, messageId, text)` - Updates message text (owner only)
- `deleteThread(threadId)` - Deletes thread (owner only)
- `truncateThread(threadId, afterMessageId)` - Removes messages after a point
- `forkAndRedirect()` - Creates editable copy of shared session

**Ownership System**:
- Owner tokens stored in localStorage: `threaded:sessions` object
- Maps `sessionId` → `{ ownerToken, forkedFrom, threadIdMap }`
- `isOwner` computed from localStorage lookup
- Non-owners can read but cannot write (triggers fork)

### `useThreadManager.ts` (196 lines)
**Purpose**: Local state management for threads and messages

**Features**:
- Maintains thread list and active thread ID
- Handles optimistic updates for streaming responses
- Manages message parts (text + tool invocations)
- Computes `activeThread` from threads array and activeThreadId

**Key Functions**:
- `addThread(thread)` - Adds thread to local state
- `updateThreadId(oldId, newId)` - Updates thread ID after API response
- `deleteThread(threadId)` - Removes thread from state
- `addMessageToThread(threadId, message)` - Adds message to thread
- `replaceMessageId(threadId, oldId, newId)` - Updates message ID
- `appendToLastMessage(threadId, chunk)` - Streams chunks to last message (legacy)
- `updateMessageParts(threadId, messageId, parts)` - Updates message parts (for tool invocations)
- `truncateThreadAfter(threadId, messageId)` - Removes messages after point
- `updateLastMessage(threadId, text)` - Updates last message text
- `replaceLastMessage(threadId, message)` - Replaces last message

**State Structure**:
```typescript
threads: Thread[]  // Array of threads
activeThreadId: string | null  // Currently selected thread
activeThread: Thread | null  // Computed from threads + activeThreadId
```

### `useAiRequest.ts` (~100 lines)
**Purpose**: Handles AI request/response lifecycle

**Features**:
- Sends requests to AI providers (OpenAI, Anthropic, Google, Ollama)
- Supports tool invocations (web search) via MessagePart format
- Handles abort signals for request cancellation
- Displays user-friendly error messages
- Saves messages to API after response completes

**Workflow**:
1. Aborts any previous in-flight request
2. Calls `aiService.generateThreadResponse()` with thread context
3. Receives complete response with text and parts (including tool invocations)
4. Creates message with response content
5. Adds message to thread via `threadManager.addMessageToThread()`
6. Saves to API via `session.addMessage()`
7. Updates message ID if API returns different ID

**Error Handling**:
- Catches `AIServiceError` objects
- Suppresses errors for user-initiated aborts
- Displays error message in message parts
- Sets loading state to false

### `useSettings.ts`
**Purpose**: Manages AI provider settings

**Storage**: localStorage key `threaded:settings`

**Settings Structure**:
```typescript
{
  provider: "google" | "openai" | "anthropic" | "ollama"
  apiKey: string
  baseUrl?: string  // For OpenAI custom bases or Ollama
  modelId: string
}
```

**Functions**:
- `openSettings()` - Opens settings modal
- `closeSettings()` - Closes modal
- `saveSettings(settings)` - Saves to localStorage and closes modal

### `useQuotes.ts`
**Purpose**: Manages saved quotes

**Storage**: localStorage key `threaded:quotes`

**Functions**:
- `addQuote(text)` - Adds quote with generated ID
- `deleteQuote(id)` - Removes quote
- `setQuotes(quotes)` - Replaces all quotes

### `useTextSelection.ts`
**Purpose**: Tracks user text selection in document

**Features**:
- Listens to `selectionchange` events
- Provides selection text and bounding rect
- Only active when `viewState === ViewState.READING`
- Clears selection on click outside

**Returns**:
```typescript
{
  selection: { text: string, rect: DOMRect | null } | null
  clearSelection: () => void
}
```

### `useDarkMode.ts`
**Purpose**: Dark mode toggle

**Storage**: localStorage key `threaded:darkMode` + system preference

**Features**:
- Respects system preference on first load
- Toggles between light/dark
- Applies `dark` class to document root

### `useKeyboardShortcuts.ts`
**Purpose**: Global keyboard shortcuts

**Shortcuts**:
- `Escape` - Closes selection or sidebar
- `Cmd/Ctrl+K` - Opens settings modal

## Service Layer (`services/`)

### `aiService.ts` (323 lines)
**Purpose**: AI provider abstraction

**Providers Supported**:
- **OpenAI**: Via `@ai-sdk/openai` (supports custom base URLs)
- **Anthropic**: Via `@ai-sdk/anthropic` (browser-direct access)
- **Google Gemini**: Via `@ai-sdk/google`
- **Ollama**: Via `ai-sdk-ollama` (local inference)

**Key Functions**:
- `streamThreadResponseWithParts()` - Streams with tool support (UIMessage format)
- `streamThreadResponse()` - Legacy text-only streaming
- `generateSessionSummary()` - Generates document summary (80 chars max)
- `getModel(settings)` - Creates provider-specific model instance
- `getProviderTools(settings)` - Returns provider tools (web search) when available
- `convertUIMessageParts(uiMessage)` - Converts AI SDK UIMessage to MessagePart[]

**Tool Support**:
- Anthropic: `web_search` tool (requires enabling in console)
- Google: `google_search` tool (grounding)
- OpenAI: `web_search` tool
- Ollama: No tool support

**Error Handling**:
- `parseError()` categorizes errors (no_key, invalid_key, invalid_model, rate_limit, network, unknown)
- Returns `AIError` with user-friendly message and retry/settings flags

### `sessionHistory.ts`
**Purpose**: Local session history management

**Storage**: localStorage key `threaded:history`

**Structure**:
```typescript
SessionMeta[] = [{
  id: string
  title: string  // Extracted from markdown
  summary: string | null  // AI-generated summary
  lastModified: number
}]
```

**Functions**:
- `getHistory()` - Returns all sessions
- `addToHistory(entry)` - Adds/updates session
- `removeFromHistory(id)` - Removes session
- `updateHistoryEntry(id, updates)` - Updates session metadata
- `getCurrentSessionId()` - Gets last active session ID
- `setCurrentSessionId(id)` - Sets current session ID
- `extractTitle(markdown)` - Extracts title from markdown (first H1 or first line)

### `contentParser.ts`
**Purpose**: Client-side content parsing (for paste/URL)

**Features**:
- Parses markdown directly from paste
- Fetches URLs and extracts content (via Worker API)
- Handles file uploads (via Worker API)

**Note**: File parsing goes through Worker API (`/api/parse`)

### `prompts.ts` (98 lines)
**Purpose**: System prompts for AI interactions

**Prompts**:
- `general` - For "Entire Document" threads (full document context)
- `discuss` - For selected text discussions (highlighted context + full document)
- `explain` - For selected text explanations (simplified, accessible)

**Features**:
- Document truncation (30KB default, configurable)
- Context-aware prompts based on mode
- Summary prompt (80 char limit)

**Function**: `getSystemPrompt(context, fullDocument, mode)` - Returns appropriate prompt

## API Client (`lib/api.ts`)

**Purpose**: REST API client for Worker endpoints

**Features**:
- Retry logic with exponential backoff (3 retries: 1s, 2s, 4s)
- Error handling with `ApiError` class
- Type-safe request/response handling

**Endpoints**:
- `createSession(markdownContent)` - POST `/api/sessions`
- `getSession(sessionId)` - GET `/api/sessions/:id`
- `deleteSession(sessionId, ownerToken)` - DELETE `/api/sessions/:id`
- `addThread(sessionId, ownerToken, context, snippet)` - POST `/api/sessions/:id/threads`
- `deleteThread(sessionId, ownerToken, threadId)` - DELETE `/api/sessions/:id/threads/:tid`
- `addMessage(...)` - POST `/api/sessions/:id/threads/:tid/messages`
- `updateMessage(...)` - PUT `/api/sessions/:id/threads/:tid/messages/:mid`
- `truncateThread(...)` - DELETE `/api/sessions/:id/threads/:tid/messages?after=:mid`
- `forkSession(sessionId)` - POST `/api/sessions/:id/fork`

## State Management

### URL as Source of Truth
- Session ID is derived from URL path (`/sessionId`)
- Navigation uses `history.pushState()` / `history.replaceState()`
- Back/forward buttons work via `popstate` listener
- `getSessionIdFromUrl()` extracts ID from pathname

### Local State (React useState)
- `viewState`: `ViewState.START | ViewState.READING | ViewState.QUOTES`
- `markdownContent`: string
- `sessionId`: string | null
- `isSidebarOpen`: boolean
- `generalInputValue`: string
- `isHistoryOpen`: boolean
- `dialog`: DialogState
- `showMoreMenu`: boolean
- `showSharedBanner`: boolean

### Persistent State (localStorage)
- **Session ownership**: `threaded:sessions` - Maps sessionId → ownership data
- **Settings**: `threaded:settings` - AI provider configuration
- **Quotes**: `threaded:quotes` - Array of saved quotes
- **Session history**: `threaded:history` - Array of session metadata
- **Dark mode**: `threaded:darkMode` - boolean
- **Current session**: `threaded:currentSessionId` - string

## Data Flow

### Creating a Session
1. User pastes/uploads content in `StartView`
2. `handleContentReady()` calls `createNewSession()` from `useSession`
3. `api.createSession()` POSTs to `/api/sessions`
4. API returns `{ sessionId, ownerToken }`
5. Owner token stored in localStorage via `setSessionOwnership()`
6. URL updated to `/${sessionId}` via `history.pushState()`
7. `sessionId` state updates → `useSession` hook loads session data
8. `useEffect` in `App.tsx` detects session loaded → sets `viewState` to READING
9. Session added to history via `addToHistory()`

### Creating a Thread
1. User selects text → `useTextSelection` detects selection
2. `Tooltip` appears at selection position
3. User clicks "Discuss" or "Explain"
4. `createThread()` in `App.tsx`:
   - Creates local thread immediately (optimistic update)
   - Generates temporary thread ID (`Date.now().toString()`)
   - Wraps selection with thread anchor via `wrapCurrentSelectionWithThreadAnchor()`
   - Adds thread to `threadManager` state
   - Sets active thread and opens sidebar
   - Clears selection
5. Calls `session.addThread()` to persist:
   - If shared session (`!isOwner`), calls `forkAndRedirect()` first
   - POSTs to `/api/sessions/:id/threads` with owner token
   - Receives API thread ID
   - Updates local thread ID via `threadManager.updateThreadId()`
   - Updates thread anchor ID in DOM
6. For "explain" action, immediately streams AI response

### Generating AI Response
1. `useAiRequest.sendRequest()` called with thread context
2. `aiService.generateThreadResponse()`:
   - Creates model instance via `getModel(settings)`
   - Gets system prompt via `getSystemPrompt()`
   - Formats message history
   - Gets provider tools (if available)
   - Calls `generateText()` from AI SDK with `stopWhen: stepCountIs(3)`
   - Processes all steps to extract tool invocations and text
3. Response received with text and MessagePart array
4. Message created and added to thread via `threadManager.addMessageToThread()`
5. UI updates reactively via React state
6. Saves to API via `session.addMessage()` (handles fork if needed)
7. Updates message ID if API returns different ID

### Forking Shared Sessions
1. User opens shared session URL (no owner token in localStorage)
2. `useSession` detects `isOwner === false`
3. User tries to edit (add thread/message)
4. `session.addThread()` or `session.addMessage()` detects `!isOwner`
5. Calls `forkAndRedirect()`:
   - POSTs to `/api/sessions/:id/fork`
   - Worker creates new session with copied data
   - Returns `{ sessionId, ownerToken, threadIdMap }`
6. Stores ownership in localStorage via `setSessionOwnership()`
7. Updates URL via `history.replaceState()` (no reload)
8. `onSessionChange` callback updates `sessionId` state
9. `useSession` reloads with new session ID
10. User can now edit freely

## Thread Anchors (`lib/threadAnchors.ts`)

Thread anchors are DOM elements that mark where threads are anchored in the document.

### Creation
- `wrapCurrentSelectionWithThreadAnchor()` - Wraps current user selection
- `wrapFirstOccurrenceWithThreadAnchor()` - Finds first occurrence of text and wraps it

### Structure
- `<span>` element with `data-thread-anchor="threadId"` attribute
- `thread-anchor` CSS class
- `tabIndex={0}` and `role="button"` for accessibility
- Contains the selected text

### Management
- Stored in `threadAnchorElsRef` Map in `App.tsx`
- Keys: thread IDs, Values: HTMLElement references
- Updated when threads added/removed/updated
- Active state managed via `data-thread-active` attribute

### Constraints
- Only wraps selections within single block element (p, li, blockquote, etc.)
- Skips text nodes already inside thread anchors
- Uses `TreeWalker` API for efficient text node traversal

### Functions
- `updateThreadAnchorId(el, newId)` - Updates thread ID attribute
- `setThreadAnchorActive(el, isActive)` - Toggles active styling
- `removeThreadAnchor(el)` - Unwraps anchor, restores original text

## Key Design Patterns

### Optimistic Updates
- Threads/messages added to local state immediately
- API calls happen in background
- IDs may be updated after API response
- UI feels instant, sync happens asynchronously

### Fork-on-Write
- Shared sessions are read-only
- First write operation triggers fork
- Seamless transition for user (no reload)
- Thread ID mapping preserves references

### URL-Based Routing
- No React Router - manual URL management
- Session ID in path determines state
- Back/forward navigation works naturally
- `popstate` listener handles browser navigation

### Component Composition
- Small, focused components
- Props-based communication
- Minimal prop drilling (hooks used instead)
- Lazy loading for heavy components (`MarkdownRenderer`)

### Error Boundaries
- `ErrorBoundary` wraps entire app
- Catches rendering errors
- Displays fallback UI
- Prevents white screen of death

## Build & Deployment

### Development
- `pnpm dev` - Vite dev server on port 3000
- Proxies `/api` requests to `http://localhost:8787` (Worker)
- Hot module replacement (HMR) for fast iteration

### Production Build
- `pnpm build` - Vite bundles to `dist/`
- Code splitting:
  - `katex` - Math rendering
  - `highlight` - Syntax highlighting
  - `markdown` - Markdown parsing
  - `ai-sdk` - AI SDK libraries
  - `icons` - Lucide icons
- Static assets copied to `dist/`

### Asset Serving
- Worker serves `dist/` via `ASSETS` binding
- SPA fallback: Worker serves `index.html` for all non-API routes
- Cache headers: `public, max-age=86400` for text content

### TypeScript
- Strict mode enabled
- No `any` types (ESLint enforced)
- Shared types in `types.ts`

