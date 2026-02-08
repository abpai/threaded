# LEARNINGS

## Corrections

| Date       | Source | What Went Wrong                                                                         | What To Do Instead                                                               |
| ---------- | ------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 2026-02-08 | self   | Deploy workflow had `github.repository_owner == 'andypai'` but GitHub handle is `abpai` | Verify actual GitHub org/user handle before setting owner guards in CI workflows |

## User Preferences

- GitHub handle/org: `abpai`
- Uses Cloudflare Workers for deployment
- Uses pnpm as package manager

## Patterns That Work

- (approaches that succeeded)

## Patterns That Don't Work

- (approaches that failed and why)

## Domain Notes

- Threaded is a contextual AI reader with Medium-style document interface
- Path alias: `@/*` maps to project root
- State managed in App.tsx via React hooks
- AI service layer supports Google, OpenAI, Anthropic providers
- Settings stored in localStorage under `threaded-settings`
