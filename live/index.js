// Entry for `pnpm live`. The server is TypeScript run by Node's built-in type stripping.
if (!process.features.typescript) {
  console.error(`Threaded Live needs Node 22.18 or newer (this is ${process.version}).`)
  process.exit(1)
}
await import('./server.ts')
