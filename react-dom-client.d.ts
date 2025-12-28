declare module 'react-dom/client' {
  import { ReactNode } from 'react'

  export interface Root {
    render(children: ReactNode): void
    unmount(): void
  }

  export function createRoot(
    container: Element | DocumentFragment,
    options?: { identifierPrefix?: string; onUncaughtError?: (error: unknown) => void }
  ): Root

  export function hydrateRoot(
    container: Element | Document,
    initialChildren: ReactNode,
    options?: { identifierPrefix?: string; onUncaughtError?: (error: unknown) => void }
  ): Root
}
