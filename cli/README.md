# @andypai/threaded

CLI tool to open local files in [Threaded](https://threaded.andypai.me) - a contextual AI reader.

## Installation

```bash
npm install -g @andypai/threaded
```

## Usage

```bash
# Open a markdown, text, or PDF file
threaded ./document.pdf

# Print URL without opening browser
threaded --no-open ./document.md
```

## Supported File Types

- **Direct**: `.md`, `.markdown`, `.txt`
- **Parsed via API**: `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.epub`, `.csv`, `.html`, `.xml`

## Options

| Option          | Description                                              |
| --------------- | -------------------------------------------------------- |
| `--no-open`     | Print the session URL without opening browser            |
| `--api <url>`   | API base URL (defaults to `https://threaded.andypai.me`) |
| `--app <url>`   | App base URL to open (defaults to same as `--api`)       |
| `-V, --version` | Show version number                                      |
| `-h, --help`    | Show help                                                |

## Environment Variables

Configure defaults in a `.env` file or your shell:

- `THREADED_API` - API base URL (default: `https://threaded.andypai.me`)
- `THREADED_APP` - App base URL (default: same as `THREADED_API`)

For local development, set:

```bash
THREADED_API=http://localhost:8787
THREADED_APP=http://localhost:3000
```

## Development

This CLI is part of the Threaded monorepo.

```bash
# From the project root
pnpm install
pnpm cli -- ./README.md
```

## License

MIT
