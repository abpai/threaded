export const LIMITS = {
  markdownContent: 500 * 1024, // 500KB
  context: 50 * 1024, // 50KB
  snippet: 1024, // 1KB
  text: 50 * 1024, // 50KB
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function validateString(value: unknown, maxLength: number, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} cannot be empty`)
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} bytes`)
  }
  return trimmed
}
