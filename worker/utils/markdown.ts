const SEPARATOR_PATTERN = /^\|[\s-]+\|[\s-|]+$/

export function fixMalformedTables(markdown: string): string {
  const lines = markdown.split("\n")
  const result: string[] = []

  for (const line of lines) {
    const prevLine = result[result.length - 1]

    if (SEPARATOR_PATTERN.test(line) && prevLine && SEPARATOR_PATTERN.test(prevLine)) {
      continue
    }
    result.push(line)
  }

  return result.join("\n")
}
