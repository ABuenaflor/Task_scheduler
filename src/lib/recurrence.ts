import { addDays, parseDateKey, toDateKey } from './dates'
import type { Recurrence, Series } from './types'

// How far ahead occurrences exist as real rows, so the calendar can count them.
const HORIZON_DAYS: Record<Recurrence, number> = { daily: 90, weekly: 180, monthly: 365 }

export function horizonDate(recurrence: Recurrence, today: string): string {
  return addDays(today, HORIZON_DAYS[recurrence])
}

// Extend only once a third of the horizon is used up, not on every sync.
export function needsExtension(series: Series, today: string): boolean {
  const threshold = addDays(today, Math.floor((HORIZON_DAYS[series.recurrence] * 2) / 3))
  return series.generated_through < threshold
}

function nthDate(recurrence: Recurrence, anchor: string, n: number): string {
  if (recurrence === 'daily') return addDays(anchor, n)
  if (recurrence === 'weekly') return addDays(anchor, n * 7)
  // Always counted from the anchor, so the 31st comes back after a short month.
  const start = parseDateKey(anchor)
  const lastDay = new Date(start.getFullYear(), start.getMonth() + n + 1, 0).getDate()
  return toDateKey(new Date(start.getFullYear(), start.getMonth() + n, Math.min(start.getDate(), lastDay)))
}

// Occurrence dates after `after` and up to `through`, inclusive.
export function occurrences(recurrence: Recurrence, anchor: string, after: string, through: string): string[] {
  const dates: string[] = []
  for (let n = 0; ; n++) {
    const date = nthDate(recurrence, anchor, n)
    if (date > through) return dates
    if (date > after) dates.push(date)
  }
}

// The dates to create next. Days that passed while the app was closed are skipped,
// so a month away doesn't leave thirty missed copies of a daily task.
export function nextOccurrences(series: Series, today: string): string[] {
  const yesterday = addDays(today, -1)
  const after = series.generated_through > yesterday ? series.generated_through : yesterday
  return occurrences(series.recurrence, series.anchor_date, after, horizonDate(series.recurrence, today))
}
