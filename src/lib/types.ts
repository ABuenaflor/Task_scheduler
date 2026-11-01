export const BUILTIN_LABELS = ['bills', 'work', 'personal', 'health', 'errands', 'other'] as const

const BUILTIN_NAMES: Record<(typeof BUILTIN_LABELS)[number], string> = {
  bills: 'Bills',
  work: 'Work',
  personal: 'Personal',
  health: 'Health',
  errands: 'Errands',
  other: 'Other',
}

export const URGENCIES = ['low', 'medium', 'high'] as const
export type Urgency = (typeof URGENCIES)[number]

export const URGENCY_NAMES: Record<Urgency, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const RECURRENCES = ['daily', 'weekly', 'monthly'] as const
export type Recurrence = (typeof RECURRENCES)[number]

export const RECURRENCE_NAMES: Record<Recurrence, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
}

export const REMINDER_OPTIONS: { minutes: number; name: string }[] = [
  { minutes: 0, name: 'At the time' },
  { minutes: 10, name: '10 minutes before' },
  { minutes: 30, name: '30 minutes before' },
  { minutes: 60, name: '1 hour before' },
  { minutes: 1440, name: '1 day before' },
]

// The fields a person fills in, shared by tasks and repeating series.
export interface TaskFields {
  title: string
  label: string
  urgency: Urgency
  due_time: string | null
  remind_minutes: number | null
}

export interface Task extends TaskFields {
  id: string
  scheduled_date: string
  completed_at: string | null
  reminded_at: string | null
  series_id: string | null
  created_at: string
  updated_at: string
}

export interface Series extends TaskFields {
  id: string
  recurrence: Recurrence
  anchor_date: string
  generated_through: string
  created_at: string
  updated_at: string
}

export interface LabelRow {
  id: string
  name: string
  slot: number | null
  created_at: string
  updated_at: string
}

// `key` is what a task stores. `series` picks the colour: every chart colour is
// checked for colour-blind safety, so only two custom labels get their own; the rest
// share the Other colour rather than getting an unvalidated one.
export interface LabelInfo {
  key: string
  name: string
  series: string
  custom: boolean
}

export const CUSTOM_SLOTS = [1, 2]

export function labelCatalog(rows: LabelRow[]): LabelInfo[] {
  const builtin = BUILTIN_LABELS.map((key) => ({ key, name: BUILTIN_NAMES[key], series: key, custom: false }))
  const custom = [...rows]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row) => ({ key: row.id, name: row.name, series: row.slot ? `c${row.slot}` : 'other', custom: true }))
  return [...builtin, ...custom]
}

// A key with no label (one deleted on another device a moment ago) reads as Other.
export function labelOf(catalog: LabelInfo[], key: string): LabelInfo {
  return catalog.find((label) => label.key === key) ?? catalog.find((label) => label.key === 'other')!
}
