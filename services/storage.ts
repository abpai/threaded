import { openDB, DBSchema, IDBPDatabase } from "idb"
import { Thread } from "../types"

const DB_NAME = "threaded-db"
const DB_VERSION = 1
const CURRENT_SESSION_ID = "current"

interface Session {
  id: string
  document: string
  threads: Thread[]
  lastModified: number
}

interface ThreadedDB extends DBSchema {
  sessions: {
    key: string
    value: Session
  }
}

let dbPromise: Promise<IDBPDatabase<ThreadedDB>> | null = null

function getDB(): Promise<IDBPDatabase<ThreadedDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ThreadedDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("sessions")) {
          db.createObjectStore("sessions", { keyPath: "id" })
        }
      },
    })
  }
  return dbPromise
}

export async function saveSession(document: string, threads: Thread[]): Promise<void> {
  const db = await getDB()
  const session: Session = {
    id: CURRENT_SESSION_ID,
    document,
    threads,
    lastModified: Date.now(),
  }
  await db.put("sessions", session)
}

export async function loadSession(): Promise<{ document: string; threads: Thread[] } | null> {
  try {
    const db = await getDB()
    const session = await db.get("sessions", CURRENT_SESSION_ID)
    if (session) {
      return {
        document: session.document,
        threads: session.threads,
      }
    }
    return null
  } catch (error) {
    console.error("Failed to load session:", error)
    return null
  }
}

export async function clearSession(): Promise<void> {
  const db = await getDB()
  await db.delete("sessions", CURRENT_SESSION_ID)
}

export async function hasSession(): Promise<boolean> {
  try {
    const db = await getDB()
    const session = await db.get("sessions", CURRENT_SESSION_ID)
    return session !== undefined
  } catch {
    return false
  }
}
