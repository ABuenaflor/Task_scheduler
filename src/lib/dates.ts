// All calendar dates are local 'YYYY-MM-DD' strings. Never use toISOString() for
// these: it converts to UTC, which shifts the day for anyone away from UTC.

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

// Monday of the week containing the date.
export function startOfWeek(key: string): string {
  const date = parseDateKey(key)
  return addDays(key, -((date.getDay() + 6) % 7))
}

export function formatLong(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function formatShort(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatFull(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

// Takes the database's '14:30:00' or a time input's '14:30'.
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// The cells of a month grid, Sunday first, padded with null for days outside the month.
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array(first.getDay()).fill(null)
  for (let day = 1; day <= days; day++) cells.push(toDateKey(new Date(year, month, day)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
