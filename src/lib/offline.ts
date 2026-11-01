import type { LabelRow, Series, Task } from './types'

// A read-only copy of the last sync, so the installed app can open with no signal.
// The database stays the source of truth: the next successful sync replaces all of it.
export interface Snapshot {
  tasks: Task[]
  series: Series[]
  labelRows: LabelRow[]
  syncedAt: string
}

export interface Identity {
  id: string
}

const PREFIX = 'offline:'
const IDENTITY_KEY = `${PREFIX}identity`
const snapshotKey = (userId: string) => `${PREFIX}snapshot:${userId}`

// Storage can be full or blocked. Offline viewing is then lost, nothing else.
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // See read().
  }
}

export const loadSnapshot = (userId: string) => read<Snapshot>(snapshotKey(userId))
export const saveSnapshot = (userId: string, snapshot: Snapshot) => write(snapshotKey(userId), snapshot)
export const loadIdentity = () => read<Identity>(IDENTITY_KEY)
export const saveIdentity = (identity: Identity) => write(IDENTITY_KEY, identity)

// Called on sign-out, so no tasks stay on a shared device.
export function clearOfflineData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // See read().
  }
}
