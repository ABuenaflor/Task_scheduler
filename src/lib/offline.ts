import type { LabelRow, Series, Task } from './types'

// A read-only copy of the last sync, so the installed app can open with no signal.
// The database stays the source of truth: the next successful sync replaces all of it.
export interface Snapshot {
  tasks: Task[]
  series: Series[]
  labelRows: LabelRow[]
  syncedAt: string
}

const SNAPSHOT_KEY = 'offline:snapshot'

// Storage can be full or blocked. Offline viewing is then lost, nothing else.
export function loadSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    return raw ? (JSON.parse(raw) as Snapshot) : null
  } catch {
    return null
  }
}

export function saveSnapshot(snapshot: Snapshot) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // See loadSnapshot().
  }
}
