import { describe, expect, it } from 'vitest'
import { addDays, monthGrid, startOfWeek, toDateKey } from './dates'
import { newId } from './ids'
import { needsExtension, nextOccurrences, occurrences } from './recurrence'
import {
  accomplishedByDay,
  activeReminders,
  analytics,
  countByDate,
  loadLevel,
  mergeRow,
  overdueTasks,
  reconcile,
  reminderTime,
  searchTasks,
  sortForToday,
} from './stats'
import { labelCatalog, type LabelRow, type Task } from './types'

const task = (over: Partial<Task>): Task => ({
  id: crypto.randomUUID(),
  title: 't',
  label: 'work',
  urgency: 'low',
  scheduled_date: '2026-11-01',
  completed_at: null,
  reminded_at: null,
  series_id: null,
  due_time: null,
  remind_minutes: null,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
  ...over,
})

// Local noon, so the test means the same day in every timezone.
const doneOn = (key: string) => new Date(`${key}T12:00:00`).toISOString()

const catalog = labelCatalog([])

describe('newId', () => {
  it('makes a valid UUID when crypto.randomUUID is missing, as on http://192.168.x.x', () => {
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })
})

describe('dates', () => {
  it('uses the local day, not the UTC day', () => {
    expect(toDateKey(new Date(2026, 10, 1, 23, 59))).toBe('2026-11-01')
    expect(toDateKey(new Date(2026, 10, 1, 0, 1))).toBe('2026-11-01')
  })

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('finds the Monday of the week', () => {
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26') // a Sunday
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02') // a Monday
  })

  it('builds a month grid aligned to Sunday', () => {
    const grid = monthGrid(2026, 1) // February 2026 starts on a Sunday
    expect(grid[0]).toBe('2026-02-01')
    expect(grid.filter(Boolean)).toHaveLength(28)
    expect(grid.length % 7).toBe(0)
    expect(monthGrid(2026, 10).length % 7).toBe(0)
  })
})

describe('loadLevel', () => {
  it('moves from green to red as the day fills up', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(loadLevel)).toEqual(['none', 'low', 'low', 'medium', 'medium', 'high', 'high'])
  })
})

describe('countByDate', () => {
  it('counts every assigned task, done or not', () => {
    const counts = countByDate([
      task({}),
      task({ completed_at: doneOn('2026-11-01') }),
      task({ scheduled_date: '2026-11-02' }),
    ])
    expect(counts).toEqual({ '2026-11-01': 2, '2026-11-02': 1 })
  })
})

describe('sortForToday', () => {
  it('puts urgent open tasks first and finished tasks last', () => {
    const sorted = sortForToday([
      task({ title: 'done-high', urgency: 'high', completed_at: doneOn('2026-11-01') }),
      task({ title: 'low' }),
      task({ title: 'high', urgency: 'high' }),
    ])
    expect(sorted.map((t) => t.title)).toEqual(['high', 'low', 'done-high'])
  })
})

describe('accomplishedByDay', () => {
  it('groups by date accomplished, newest first, ignoring open tasks', () => {
    const groups = accomplishedByDay([
      task({ completed_at: doneOn('2026-10-30') }),
      task({ completed_at: doneOn('2026-11-01') }),
      task({ completed_at: doneOn('2026-10-30') }),
      task({}),
    ])
    expect(groups.map((g) => [g.date, g.tasks.length])).toEqual([
      ['2026-11-01', 1],
      ['2026-10-30', 2],
    ])
  })

  it('compares timestamps as instants, whatever format the server sent', () => {
    const groups = accomplishedByDay([
      task({ title: 'earlier', completed_at: '2026-11-01T10:00:00+00:00' }),
      task({ title: 'later', completed_at: '2026-11-01T05:00:00-08:00' }), // 13:00 UTC
    ])
    expect(groups.flatMap((g) => g.tasks.map((t) => t.title))[0]).toBe('later')
  })
})

describe('analytics', () => {
  const today = '2026-11-01'

  it('counts per category inside the window only', () => {
    const result = analytics(
      [
        task({ label: 'bills', completed_at: doneOn('2026-11-01') }),
        task({ label: 'bills', completed_at: doneOn('2026-10-26') }),
        task({ label: 'work', completed_at: doneOn('2026-10-25') }), // one day outside 7 days
      ],
      today,
      7,
      catalog,
    )
    expect(result.total).toBe(2)
    expect(result.byLabel.find((row) => row.label.key === 'bills')!.count).toBe(2)
    expect(result.byLabel.find((row) => row.label.key === 'work')!.count).toBe(0)
  })

  it('fills empty days so the trend line has no gaps', () => {
    const { trend } = analytics([task({ completed_at: doneOn('2026-10-29') })], today, 7, catalog)
    expect(trend).toHaveLength(7)
    expect(trend[0].date).toBe('2026-10-26')
    expect(trend.at(-1)!.date).toBe(today)
    expect(trend.map((p) => p.count)).toEqual([0, 0, 0, 1, 0, 0, 0])
  })

  it('averages over the trailing 7 days, including days before the window', () => {
    const { trend } = analytics(
      [task({ completed_at: doneOn('2026-10-25') }), task({ completed_at: doneOn('2026-10-26') })],
      today,
      7,
      catalog,
    )
    expect(trend[0].date).toBe('2026-10-26')
    expect(trend[0].average).toBeCloseTo(2 / 7) // Oct 25 is outside the window but inside its average
    expect(trend.at(-1)!.average).toBeCloseTo(0 + 1 / 7) // Oct 26 is the 7th day back from Nov 1
  })

  it('buckets weeks without losing tasks at the window edge', () => {
    const { weekly, total } = analytics(
      [
        task({ label: 'bills', completed_at: doneOn('2026-10-03') }), // first day of a 30-day window
        task({ label: 'work', completed_at: doneOn(today) }),
      ],
      today,
      30,
      catalog,
    )
    expect(total).toBe(2)
    expect(weekly.reduce((sum, week) => sum + week.total, 0)).toBe(2)
  })

  it('reports completion rate for tasks due in the window, and null when none', () => {
    const result = analytics(
      [task({ completed_at: doneOn(today) }), task({}), task({ scheduled_date: '2026-11-20' })],
      today,
      7,
      catalog,
    )
    expect(result.completionRate).toBe(0.5)
    expect(analytics([], today, 7, catalog).completionRate).toBeNull()
  })
})

describe('sync merging', () => {
  const older = '2026-11-01T10:00:00.000000+00:00'
  const newer = '2026-11-01T11:00:00.000000+00:00'

  it('never duplicates a row delivered twice', () => {
    const row = task({})
    expect(mergeRow(mergeRow([], row), row)).toHaveLength(1)
  })

  it('ignores a late event older than what we have', () => {
    const current = task({ title: 'new', updated_at: newer })
    const stale = { ...current, title: 'old', updated_at: older }
    expect(mergeRow([current], stale)[0].title).toBe('new')
  })

  it('takes the database version on a full fetch and drops rows it no longer has', () => {
    const kept = task({ title: 'local', updated_at: older })
    const gone = task({ title: 'gone' })
    const result = reconcile([kept, gone], [{ ...kept, title: 'remote', updated_at: newer }], new Set())
    expect(result.map((t) => t.title)).toEqual(['remote'])
  })

  it('keeps an optimistic value while its write is in flight', () => {
    const optimistic = task({ completed_at: doneOn('2026-11-01'), updated_at: older })
    const remote = { ...optimistic, completed_at: null, updated_at: newer }
    expect(reconcile([optimistic], [remote], new Set([optimistic.id]))[0].completed_at).not.toBeNull()
  })
})

const labelRow = (id: string, slot: number | null, created_at: string): LabelRow => ({
  id,
  name: id,
  slot,
  created_at,
  updated_at: created_at,
})

describe('custom labels', () => {
  const custom = labelCatalog([
    labelRow('third', null, '2026-03-01'),
    labelRow('first', 1, '2026-01-01'),
    labelRow('second', 2, '2026-02-01'),
  ])

  it('gives two labels their own colour and shares Other for the rest', () => {
    expect(custom.filter((l) => l.custom).map((l) => [l.key, l.series])).toEqual([
      ['first', 'c1'],
      ['second', 'c2'],
      ['third', 'other'],
    ])
  })

  it('stacks an overflow label inside Other, without losing it from the category bars', () => {
    const result = analytics(
      [
        task({ label: 'third', completed_at: doneOn('2026-11-01') }),
        task({ label: 'other', completed_at: doneOn('2026-11-01') }),
        task({ label: 'first', completed_at: doneOn('2026-11-01') }),
      ],
      '2026-11-01',
      7,
      custom,
    )
    expect(result.byLabel.find((row) => row.label.key === 'third')!.count).toBe(1)
    expect(result.series.map((s) => s.key)).not.toContain('third')
    const week = result.weekly.at(-1)!
    expect(week.counts.other).toBe(2)
    expect(week.counts.c1).toBe(1)
    expect(week.total).toBe(3)
  })

  it('counts a task whose label was deleted as Other', () => {
    const result = analytics([task({ label: 'gone', completed_at: doneOn('2026-11-01') })], '2026-11-01', 7, catalog)
    expect(result.byLabel.find((row) => row.label.key === 'other')!.count).toBe(1)
    expect(result.weekly.at(-1)!.counts.other).toBe(1)
  })
})

describe('recurrence', () => {
  it('repeats daily and weekly', () => {
    expect(occurrences('daily', '2026-11-01', '2026-11-01', '2026-11-03')).toEqual(['2026-11-02', '2026-11-03'])
    expect(occurrences('weekly', '2026-11-01', '2026-11-01', '2026-11-22')).toEqual([
      '2026-11-08',
      '2026-11-15',
      '2026-11-22',
    ])
  })

  it('clamps the 31st to short months and returns to the 31st afterwards', () => {
    expect(occurrences('monthly', '2026-01-31', '2026-01-31', '2026-05-31')).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
  })

  it('handles a leap year and a year boundary', () => {
    expect(occurrences('monthly', '2027-12-31', '2027-12-31', '2028-02-29')).toEqual(['2028-01-31', '2028-02-29'])
  })

  const series = (over: object) => ({
    id: 's',
    title: 't',
    label: 'work',
    urgency: 'low' as const,
    due_time: null,
    remind_minutes: null,
    recurrence: 'daily' as const,
    anchor_date: '2026-01-01',
    generated_through: '2026-01-01',
    created_at: '',
    updated_at: '',
    ...over,
  })

  it('never creates a date already generated, so a deleted occurrence stays deleted', () => {
    const dates = nextOccurrences(series({ generated_through: '2026-11-10' }), '2026-11-01')
    expect(dates[0]).toBe('2026-11-11')
  })

  it('skips days that passed while the app was closed', () => {
    const dates = nextOccurrences(series({ generated_through: '2026-06-01' }), '2026-11-01')
    expect(dates[0]).toBe('2026-11-01')
  })

  it('does not extend until a third of the horizon is used', () => {
    expect(needsExtension(series({ generated_through: '2027-01-30' }), '2026-11-01')).toBe(false) // 90 days out
    expect(needsExtension(series({ generated_through: '2026-12-01' }), '2026-11-01')).toBe(true)
  })
})

describe('overdueTasks', () => {
  const today = '2026-11-01'

  it('lists unfinished past tasks only, newest first', () => {
    const list = overdueTasks(
      [
        task({ title: 'older', scheduled_date: '2026-10-01' }),
        task({ title: 'newer', scheduled_date: '2026-10-20' }),
        task({ title: 'done', scheduled_date: '2026-10-21', completed_at: doneOn('2026-10-21') }),
        task({ title: 'today', scheduled_date: today }),
      ],
      today,
    )
    expect(list.map((t) => t.title)).toEqual(['newer', 'older'])
  })

  it('shows a missed repeating task once, at its latest date', () => {
    const list = overdueTasks(
      [
        task({ series_id: 's', scheduled_date: '2026-10-29' }),
        task({ series_id: 's', scheduled_date: '2026-10-31' }),
        task({ series_id: 's', scheduled_date: '2026-10-30' }),
      ],
      today,
    )
    expect(list.map((t) => t.scheduled_date)).toEqual(['2026-10-31'])
  })
})

describe('reminders', () => {
  const at = (key: string, time: string) => new Date(`${key}T${time}`).getTime()
  const reminded = (over: Partial<Task> = {}) =>
    task({ scheduled_date: '2026-11-01', due_time: '14:30:00', remind_minutes: 30, ...over })

  it('computes the time from the local date, time and offset', () => {
    expect(reminderTime(reminded())).toBe(at('2026-11-01', '14:00:00'))
    expect(reminderTime(reminded({ remind_minutes: 1440 }))).toBe(at('2026-10-31', '14:30:00'))
    expect(reminderTime(reminded({ remind_minutes: null }))).toBeNull()
    expect(reminderTime(reminded({ due_time: null }))).toBeNull()
  })

  it('fires from its time, not before', () => {
    expect(activeReminders([reminded()], at('2026-11-01', '13:59:59'))).toHaveLength(0)
    expect(activeReminders([reminded()], at('2026-11-01', '14:00:00'))).toHaveLength(1)
  })

  it('stops once dismissed, completed or a day old', () => {
    const now = at('2026-11-01', '15:00:00')
    expect(activeReminders([reminded({ reminded_at: doneOn('2026-11-01') })], now)).toHaveLength(0)
    expect(activeReminders([reminded({ completed_at: doneOn('2026-11-01') })], now)).toHaveLength(0)
    expect(activeReminders([reminded()], at('2026-11-02', '14:00:00'))).toHaveLength(0)
    expect(activeReminders([reminded()], at('2026-11-02', '13:59:00'))).toHaveLength(1)
  })
})

describe('searchTasks', () => {
  const today = '2026-11-01'
  const all = { query: '', label: null, urgency: null, status: 'all' as const }
  const list = [
    task({ title: 'Pay Rent', label: 'bills', urgency: 'high', scheduled_date: '2026-10-01' }),
    task({ title: 'Team sync', label: 'work', scheduled_date: '2026-10-02', completed_at: doneOn('2026-10-02') }),
  ]

  it('matches title regardless of case and ignores surrounding spaces', () => {
    expect(searchTasks(list, { ...all, query: '  rent ' }, today).map((t) => t.title)).toEqual(['Pay Rent'])
  })

  it('combines filters', () => {
    expect(searchTasks(list, { ...all, label: 'work', status: 'done' }, today)).toHaveLength(1)
    expect(searchTasks(list, { ...all, label: 'work', status: 'open' }, today)).toHaveLength(0)
    expect(searchTasks(list, { ...all, urgency: 'high' }, today)).toHaveLength(1)
  })

  it('lists newest first and only the next upcoming copy of a repeating task', () => {
    const results = searchTasks(
      [
        task({ title: 'past copy', series_id: 's', scheduled_date: '2026-10-25' }),
        task({ title: 'next copy', series_id: 's', scheduled_date: '2026-11-02' }),
        task({ title: 'later copy', series_id: 's', scheduled_date: '2026-11-09' }),
      ],
      all,
      today,
    )
    expect(results.map((t) => t.title)).toEqual(['next copy', 'past copy'])
  })
})

describe('deleted rows', () => {
  it('keeps a deleted row gone when an older fetch still contains it', () => {
    const row = task({})
    expect(reconcile([], [row], new Set(), new Set([row.id]))).toEqual([])
  })
})
