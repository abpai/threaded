import { SessionMeta } from "../types"

const HISTORY_KEY = "threaded:session-history"
const CURRENT_KEY = "threaded:current-session"
const MAX_HISTORY = 50

export type SessionHistoryEntry = SessionMeta

export function getHistory(): SessionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addToHistory(entry: SessionHistoryEntry): void {
  const history = getHistory().filter(h => h.id !== entry.id)
  history.unshift(entry)
  if (history.length > MAX_HISTORY) history.pop()
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function removeFromHistory(id: string): void {
  const history = getHistory().filter(h => h.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function updateHistoryEntry(id: string, updates: Partial<SessionHistoryEntry>): void {
  const history = getHistory()
  const idx = history.findIndex(h => h.id === id)
  if (idx !== -1) {
    history[idx] = { ...history[idx], ...updates }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }
}

export function getCurrentSessionId(): string | null {
  return localStorage.getItem(CURRENT_KEY)
}

export function setCurrentSessionId(id: string | null): void {
  if (id) {
    localStorage.setItem(CURRENT_KEY, id)
  } else {
    localStorage.removeItem(CURRENT_KEY)
  }
}

export function extractTitle(document: string): string {
  const firstLine = document.trim().split("\n")[0] || ""
  const cleaned = firstLine.replace(/^#+\s*/, "").trim()
  if (cleaned.length > 60) {
    return cleaned.slice(0, 57) + "..."
  }
  return cleaned || "Untitled"
}
