import { addDays, parseDateKey, startOfWeek, toDateKey } from './dates'
import { URGENCIES, labelOf, type LabelInfo, type Task, type Urgency } from './types'

export type Load = 'none' | 'low' | 'medium' | 'high'

export const AVERAGE_DAYS = 7

// Calendar tile colour: green is a light day, red is a loaded one.
export function loadLevel(count: number): Load {
  if (count === 0) return 'none'
  if (count <= 2) return 'low'
  if (count <= 4) return 'medium'
  return 'high'
}

export function countByDate(tasks: Task[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const task of tasks) counts[task.scheduled_date] = (counts[task.scheduled_date] ?? 0) + 1
  return counts
}

// Open tasks first, most urgent on top, then by time; finished tasks sink to the bottom.
export function sortForToday(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.completed_at !== null) - Number(b.completed_at !== null) ||
      URGENCIES.indexOf(b.urgency) - URGENCIES.indexOf(a.urgency) ||
      (a.due_time ?? '99').localeCompare(b.due_time ?? '99') ||
      a.created_at.localeCompare(b.created_at),
  )
}

// Unfinished tasks from before today, newest first. A repeating task counts once: only
// its latest missed occurrence shows, so a missed daily task doesn't pile up.
export function overdueTasks(tasks: Task[], today: string): Task[] {
  const missed = tasks
    .filter((task) => !task.completed_at && task.scheduled_date < today)
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
  const seen = new Set<string>()
  return missed.filter((task) => {
    if (!task.series_id) return true
    if (seen.has(task.series_id)) return false
    seen.add(task.series_id)
    return true
  })
}

export function completedDateKey(task: Task): string | null {
  return task.completed_at ? toDateKey(new Date(task.completed_at)) : null
}

export function accomplishedByDay(tasks: Task[]): { date: string; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>()
  const done = tasks
    .filter((task) => task.completed_at)
    .sort((a, b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!))
  for (const task of done) {
    const key = completedDateKey(task)!
    groups.set(key, [...(groups.get(key) ?? []), task])
  }
  return [...groups].map(([date, tasks]) => ({ date, tasks }))
}

export interface Analytics {
  total: number
  completionRate: number | null
  byLabel: { label: LabelInfo; count: number }[]
  trend: { date: string; count: number; average: number }[]
  // Stack segments are keyed by colour series, so labels sharing a colour share a segment.
  series: LabelInfo[]
  weekly: { week: string; counts: Record<string, number>; total: number }[]
}

// Accomplished tasks inside the `days` ending today. Completion rate compares tasks
// that were due in the window (up to today) with how many of those got done.
export function analytics(tasks: Task[], today: string, days: number, catalog: LabelInfo[]): Analytics {
  const start = addDays(today, -(days - 1))
  const inWindow = (key: string) => key >= start && key <= today
  const done = tasks.filter((task) => {
    const key = completedDateKey(task)
    return key !== null && inWindow(key)
  })

  const byLabel = catalog.map((label) => ({
    label,
    count: done.filter((task) => labelOf(catalog, task.label).key === label.key).length,
  }))

  // Counted across all history, so the average is correct from the window's first day.
  const perDay: Record<string, number> = {}
  for (const task of tasks) {
    const key = completedDateKey(task)
    if (key) perDay[key] = (perDay[key] ?? 0) + 1
  }

  const series = catalog.filter((label) => !label.custom || label.series !== 'other')
  const weeks = new Map<string, Record<string, number>>()
  for (let key = startOfWeek(start); key <= today; key = addDays(key, 7)) {
    weeks.set(key, Object.fromEntries(series.map((label) => [label.series, 0])))
  }
  for (const task of done) {
    weeks.get(startOfWeek(completedDateKey(task)!))![labelOf(catalog, task.label).series]++
  }

  const trend: Analytics['trend'] = []
  for (let key = start; key <= today; key = addDays(key, 1)) {
    let sum = 0
    for (let back = 0; back < AVERAGE_DAYS; back++) sum += perDay[addDays(key, -back)] ?? 0
    trend.push({ date: key, count: perDay[key] ?? 0, average: sum / AVERAGE_DAYS })
  }

  const due = tasks.filter((task) => inWindow(task.scheduled_date))
  const dueDone = due.filter((task) => task.completed_at).length

  return {
    total: done.length,
    completionRate: due.length ? dueDone / due.length : null,
    byLabel,
    trend,
    series,
    weekly: [...weeks].map(([week, counts]) => ({
      week,
      counts,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    })),
  }
}

// When a task's reminder goes off, or null if it has none.
export function reminderTime(task: Task): number | null {
  if (task.remind_minutes === null || !task.due_time) return null
  const date = parseDateKey(task.scheduled_date)
  const [hours, minutes] = task.due_time.split(':').map(Number)
  date.setHours(hours, minutes)
  return date.getTime() - task.remind_minutes * 60_000
}

const REMINDER_EXPIRY_MS = 24 * 60 * 60_000

// Reminders are derived, not scheduled: any device with the app open shows what is due,
// and dismissing one (reminded_at, in the database) clears it on the others. One missed
// while the app was closed still shows on opening, for a day.
export function activeReminders(tasks: Task[], now: number): Task[] {
  return tasks
    .filter((task) => {
      const time = reminderTime(task)
      return time !== null && !task.completed_at && !task.reminded_at && time <= now && now - time < REMINDER_EXPIRY_MS
    })
    .sort((a, b) => reminderTime(a)! - reminderTime(b)!)
}

export interface SearchFilters {
  query: string
  label: string | null
  urgency: Urgency | null
  status: 'all' | 'open' | 'done'
}

// Newest first. A repeating task's future copies would otherwise bury everything,
// so only its next upcoming occurrence is listed.
export function searchTasks(tasks: Task[], filters: SearchFilters, today: string): Task[] {
  const query = filters.query.trim().toLowerCase()
  const matches = tasks
    .filter(
      (task) =>
        (!query || task.title.toLowerCase().includes(query)) &&
        (!filters.label || task.label === filters.label) &&
        (!filters.urgency || task.urgency === filters.urgency) &&
        (filters.status === 'all' || (filters.status === 'done') === (task.completed_at !== null)),
    )
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))

  const seen = new Set<string>()
  return matches
    .filter((task) => {
      if (!task.series_id || task.completed_at || task.scheduled_date < today) return true
      if (seen.has(task.series_id)) return false
      seen.add(task.series_id)
      return true
    })
    .reverse()
}

function newest<T extends { updated_at: string }>(a: T, b: T): T {
  return Date.parse(a.updated_at) > Date.parse(b.updated_at) ? a : b
}

// Merge a full fetch into local state. The database is the source of truth: rows it
// no longer has are dropped. Rows with a write in flight keep their optimistic value,
// and rows being deleted stay gone.
export function reconcile(
  local: Task[],
  remote: Task[],
  pending: ReadonlySet<string>,
  deleted: ReadonlySet<string> = new Set(),
): Task[] {
  const byId = new Map(local.map((task) => [task.id, task]))
  return remote
    .filter((row) => !deleted.has(row.id))
    .map((row) => {
      const mine = byId.get(row.id)
      if (!mine) return row
      return pending.has(row.id) ? mine : newest(mine, row)
    })
}

// Merge one row by id, so the same change arriving twice never creates a duplicate.
export function mergeRow<T extends { id: string; updated_at: string }>(local: T[], row: T): T[] {
  const index = local.findIndex((item) => item.id === row.id)
  if (index === -1) return [...local, row]
  const next = [...local]
  next[index] = newest(local[index], row)
  return next
}
