# LEARNINGS

## Corrections

| Date       | Source | What Went Wrong                                                                         | What To Do Instead                                                               |
| ---------- | ------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 2026-02-08 | self   | Deploy workflow had `github.repository_owner == 'andypai'` but GitHub handle is `abpai` | Verify actual GitHub org/user handle before setting owner guards in CI workflows |

## User Preferences

- GitHub handle/org: `abpai`
- Uses Cloudflare Workers for deployment
- Uses pnpm as package manager
- Default product theme should be white/light mode; dark mode is optional and secondary in docs and UI framing
- Reading-view links should be visually distinct from body text and from thread-anchor highlights

## Patterns That Work

- In dense TSX components, extracting textarea/input event handlers into named functions improves readability without changing behavior.
- When reviewing design docs in this repo, cross-check `DESIGN.md` against `index.css` and `tailwind.config.js`; the style guide can drift from the live classes and tokens.
- When changing the app's default theme color in `index.html`, keep the `meta[name="theme-color"]` tag in sync at runtime so dark mode also updates mobile browser chrome.
- For local verification in this repo, prefer `pnpm exec tsc --noEmit` over `npx tsc --noEmit`; `npx` may not be available in the shell environment.

## Patterns That Don't Work

- (approaches that failed and why)

## Domain Notes

- Threaded is a contextual AI reader with Medium-style document interface
- Path alias: `@/*` maps to project root
- State managed in App.tsx via React hooks
- AI service layer supports Google, OpenAI, Anthropic providers
- Settings stored in localStorage under `threaded-settings`
