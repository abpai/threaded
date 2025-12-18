export function generateId(): string {
  try {
    // Modern browsers / Node 19+
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (crypto as any).randomUUID()
    }
  } catch {
    // fall through to fallback
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
