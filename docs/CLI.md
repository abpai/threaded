# CLI Architecture

Threaded includes a Node.js-based CLI tool for opening local files directly in the web application. It handles file parsing, session creation, and browser opening.

## Overview

The CLI (`cli/src/index.ts`) is a command-line utility that:

1. Reads a local file
2. Optionally parses it (for PDFs, DOCX, etc.) via the Worker API
3. Creates a session via the API
4. Opens the session URL in the browser

## Technology Stack

- **Runtime**: Node.js (>=18.0.0)
- **CLI Framework**: Commander.js (v12.0.0)
- **Browser Opening**: `open` package (v10.0.0, cross-platform)

## Command Structure

```bash
threaded <filepath> [options]
```

### Arguments

- `<filepath>` - Path to file to open (required, relative or absolute)

### Options

- `--no-open` - Print URL without opening browser
- `--api <url>` - API base URL (default: `https://threaded.andypai.me`)
- `--app <url>` - App base URL to open (default: same as `--api`)

### Environment Variables

- `THREADED_API` - API base URL (overridden by `--api` flag)
- `THREADED_APP` - App base URL (overridden by `--app` flag)

## File Type Handling

### Direct Text Files

Files that can be read directly as text (no parsing needed):

- `.md` - Markdown
- `.txt` - Plain text
- `.markdown` - Markdown

**Process**:

1. Read file via `readFileSync(filepath, 'utf-8')`
2. Validate non-empty
3. Use content as-is (no API call)

**Constants**: `DIRECT_EXTS = new Set(['.md', '.txt', '.markdown'])`

### Parsed Files

Files that require parsing via Worker API:

- `.pdf` - PDF documents
- `.docx` - Word documents
- `.xlsx` - Excel spreadsheets
- `.pptx` - PowerPoint presentations
- `.epub` - EPUB ebooks
- `.csv` - CSV files
- `.html` - HTML files
- `.xml` - XML files

**Process**:

1. Read file via `readFileSync(filepath)` (binary)
2. Create FormData with file
3. POST to `/api/parse` endpoint
4. Receive markdown from API
5. Use markdown for session creation

**Constants**: `PARSE_EXTS = new Set([...])`

### Unsupported Files

- Any other extension
- Error: `Unsupported file type: <ext>`
- Lists supported extensions in error message

## Workflow

### 1. File Reading (`getMarkdownForFile()`)

```typescript
async function getMarkdownForFile(apiBase: string, filepath: string): Promise<string>
```

**Process**:

1. Resolves absolute path via `path.resolve(filepath)`
2. Checks file exists via `existsSync(absPath)`
3. Throws error if file not found
4. Determines file extension via `path.extname(absPath).toLowerCase()`
5. Routes to appropriate handler:
   - **Direct text**: Read file, validate non-empty, return text
   - **Parse required**: Read file, POST to `/api/parse`, return markdown
   - **Unsupported**: Throw error with supported extensions list

**Error Cases**:

- File not found: `File not found: <absPath>`
- File empty: `File is empty`
- Unsupported type: `Unsupported file type: <ext>`
- Parse API error: `Parse failed: <status>` or API error message

### 2. Session Creation (`createSession()`)

```typescript
async function createSession(apiBase: string, markdown: string): Promise<string>
```

**Process**:

1. POSTs markdown to `/api/sessions` endpoint
2. Request body: `{ markdownContent: markdown }`
3. Receives `{ sessionId, ownerToken }` from API
4. Returns `sessionId` (owner token not used by CLI)

**Error Cases**:

- API error: `Failed to create session: <status>` or API error message
- Network error: Propagated from fetch

**Note**: Owner token is returned but not used (user manages in browser)

### 3. URL Construction (`joinUrl()`)

```typescript
function joinUrl(base: string, subpath: string): string
```

**Process**:

1. Normalizes base URL via `normalizeUrl()`:
   - Adds `https://` if missing
   - Removes trailing slashes
2. Normalizes subpath:
   - Removes leading slashes
3. Joins with single `/`
4. Returns full URL

**Example**:

- Base: `https://threaded.andypai.me/`
- Subpath: `/abc123`
- Result: `https://threaded.andypai.me/abc123`

### 4. Browser Opening (`open()`)

**Process**:

1. Uses `open` package (cross-platform)
2. Opens URL in default browser
3. Only executes if `--no-open` flag not set

**Platform Support**:

- macOS: Uses `open` command
- Linux: Uses `xdg-open`
- Windows: Uses `start` command

## URL Normalization

### `normalizeUrl()`

```typescript
function normalizeUrl(url: string): string
```

**Process**:

1. Adds `https://` if URL doesn't start with `http`
2. Removes trailing slashes via `.replace(/\/+$/, '')`
3. Returns normalized URL

**Examples**:

- `threaded.andypai.me` → `https://threaded.andypai.me`
- `https://threaded.andypai.me/` → `https://threaded.andypai.me`
- `http://localhost:8787` → `http://localhost:8787`

### `joinUrl()`

```typescript
function joinUrl(base: string, subpath: string): string
```

**Process**:

1. Normalizes base URL
2. Removes leading slashes from subpath
3. Joins with single `/`
4. Returns full URL

**Examples**:

- Base: `https://example.com/`, Subpath: `/session123` → `https://example.com/session123`
- Base: `https://example.com`, Subpath: `session123` → `https://example.com/session123`

## API Integration

### Parse Endpoint

**Endpoint**: `POST /api/parse`

**Request**:

- Content-Type: `multipart/form-data`
- Body: FormData with `file` field
- File: Binary file data

**Response**:

```json
{
  "markdown": string,
  "source": "file",
  "cached": boolean  // Optional
}
```

**Error Response**:

```json
{
  "error": "Error message"
}
```

**Status Codes**:

- 200 - Success
- 400 - Bad request (file too large, unsupported type, empty)
- 500 - Server error (parsing failed)

### Session Endpoint

**Endpoint**: `POST /api/sessions`

**Request**:

- Content-Type: `application/json`
- Body: `{ markdownContent: string }`

**Response**:

```json
{
  "sessionId": string,
  "ownerToken": string
}
```

**Error Response**:

```json
{
  "error": "Error message"
}
```

**Status Codes**:

- 201 - Created
- 400 - Bad request (invalid markdown, too large)
- 500 - Server error

## Error Handling

### File Errors

- **File not found**: `File not found: <absPath>`
  - Exit code: 1
- **File empty**: `File is empty`
  - Exit code: 1
- **Unsupported type**: `Unsupported file type: <ext>\nSupported: ...`
  - Exit code: 1
  - Lists all supported extensions

### API Errors

- **Parse failed**: `Parse failed: <status>` or API error message
  - Exit code: 1
- **Session creation failed**: `Failed to create session: <status>` or API error message
  - Exit code: 1
- **Network errors**: Propagated from fetch, shows error message
  - Exit code: 1

### Error Display

- All errors printed to `stderr` via `console.error()`
- Success URL printed to `stdout` via `console.info()`
- Exit code: 0 on success, 1 on error

## Build & Installation

### Build

```bash
cd cli && npm run build
```

**Note**: CLI uses Node.js runtime with TypeScript compilation. Build step required before use.

**Direct Execution**:

- Can run directly: `tsx cli/src/index.ts <filepath>` (development)
- Built version: `node cli/dist/index.js <filepath>`
- Shebang `#!/usr/bin/env node` allows direct execution after build

### Package Configuration

**`cli/package.json`**:

- `bin.threaded`: Points to `dist/index.js`
- `engines.node`: Requires Node.js >= 18.0.0
- `type`: `"module"` (ESM)

### Installation

**Global Install** (hypothetical):

```bash
npm install -g @andypai/threaded
```

**Local Usage**:

```bash
tsx cli/src/index.ts document.pdf
```

**Via pnpm workspace**:

```bash
pnpm cli -- document.pdf
```

## Usage Examples

### Basic Usage

```bash
threaded document.pdf
```

- Reads PDF
- Parses via API
- Creates session
- Opens browser to session URL

### Custom API

```bash
threaded document.md --api http://localhost:8787
```

- Uses local development API
- Useful for testing

### No Browser

```bash
threaded document.txt --no-open
```

- Prints URL to stdout
- Does not open browser
- Useful for scripting

### Different App URL

```bash
threaded document.pdf --api https://api.example.com --app https://app.example.com
```

- Uses different URLs for API and app
- Useful for CDN deployments

### Environment Variables

```bash
export THREADED_API=https://api.example.com
export THREADED_APP=https://app.example.com
threaded document.pdf
```

- Uses environment variables
- Can be overridden by flags

## Design Decisions

### Why Node.js?

- **Cross-platform**: Works on macOS, Linux, and Windows
- **Standard APIs**: Uses Node.js built-in modules (`fs`, `path`)
- **TypeScript support**: Uses `tsx` for development, compiled for production
- **Modern APIs**: Built-in fetch, FormData, etc. (Node.js 18+)

### Why Not Use Owner Token?

- CLI doesn't need to manage sessions
- User authenticates in browser (localStorage)
- Simpler CLI interface
- Owner token returned but ignored
- **Result**: The created session is effectively "read-only" for the creator until they fork it (Fork-on-Write), as the CLI discards the initial write token.

### Why Separate API/App URLs?

- Allows API and app on different domains
- Useful for development/testing
- Supports CDN deployments (app on CDN, API on Worker)
- Flexible deployment architecture

### Why Commander.js?

- Standard CLI framework
- Handles argument parsing
- Built-in help text
- Version flag support

## Limitations

### File Size

- Limited by API's 10MB limit
- No client-side size check (API validates)
- Large files may fail at API level

### Network Dependency

- Requires internet connection
- API must be accessible
- No offline mode
- Network errors not retried (fails immediately)

### Error Messages

- Generic errors from API
- No detailed parsing errors
- Network errors may be unclear
- No progress indicators for large files

### Platform Support

- Requires Node.js >= 18.0.0
- Browser opening via `open` package (cross-platform)
- File path handling may differ on Windows

## Future Enhancements

### Potential Features

- **Progress indicators**: Show parsing progress for large files
- **Batch processing**: Process multiple files at once
- **Local caching**: Cache parsed content locally
- **Config file**: `.threadedrc` for default settings
- **Interactive mode**: File picker instead of command-line argument
- **Retry logic**: Retry failed API calls with exponential backoff
- **Verbose mode**: `--verbose` flag for detailed logging
- **Dry run**: `--dry-run` flag to test without creating session

## Code Structure

### Main Entry Point (`cli/src/index.ts`)

- 121 lines
- Commander.js program setup
- Command action handler
- Error handling and exit codes

### Helper Functions

- `normalizeUrl()` - URL normalization
- `joinUrl()` - URL joining
- `getMarkdownForFile()` - File reading/parsing
- `createSession()` - Session creation

### Constants

- `DEFAULT_API` - Default API URL
- `DIRECT_EXTS` - Direct text file extensions
- `PARSE_EXTS` - Parsed file extensions

### Type Definitions

- `CreateSessionResponse` - API response type
- `ParseResponse` - Parse API response type

## Testing Considerations

### Manual Testing

- Test with various file types
- Test with local and remote APIs
- Test error cases (missing file, network error, etc.)
- Test URL normalization edge cases

### Automated Testing

- Unit tests for URL normalization
- Integration tests with mock API
- File reading tests
- Error handling tests
