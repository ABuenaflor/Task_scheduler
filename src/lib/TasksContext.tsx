import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, toDateKey } from './dates'
import { newId } from './ids'
import { loadSnapshot, saveSnapshot } from './offline'
import { horizonDate, needsExtension, nextOccurrences } from './recurrence'
import { mergeRow, reconcile } from './stats'
import {
  CUSTOM_SLOTS,
  labelCatalog,
  labelOf,
  type LabelInfo,
  type LabelRow,
  type Recurrence,
  type Series,
  type Task,
  type TaskFields,
} from './types'

export type SyncStatus = 'loading' | 'syncing' | 'synced' | 'offline'
export type Scope = 'this' | 'future'

interface TasksContextValue {
  tasks: Task[]
  series: Series[]
  labels: LabelInfo[]
  labelFor: (key: string) => LabelInfo
  status: SyncStatus
  lastSynced: Date | null
  sync: () => Promise<void>
  createTask: (ids: { task: string; series: string }, fields: TaskFields, date: string, recurrence: Recurrence | null) => Promise<void>
  updateTask: (task: Task, fields: TaskFields, date: string, scope: Scope, recurrence: Recurrence | null) => Promise<void>
  deleteTask: (task: Task, scope: Scope) => Promise<void>
  stopRepeating: (task: Task) => Promise<void>
  moveToToday: (task: Task) => Promise<void>
  setCompleted: (task: Task, done: boolean) => Promise<void>
  dismissReminder: (task: Task) => Promise<void>
  addLabel: (name: string) => Promise<string>
  renameLabel: (id: string, name: string) => Promise<void>
  deleteLabel: (id: string) => Promise<void>
  toast: string | null
  showToast: (message: string) => void
}

const TasksContext = createContext<TasksContextValue | null>(null)

const PAGE_SIZE = 1000
const POLL_MS = 60_000
const UNIQUE_VIOLATION = '23505'

export const DUPLICATE_LABEL = 'You already have a label with that name.'

// Fail at once when the device knows it's offline, rather than waiting on the network.
function requireOnline() {
  if (!navigator.onLine) throw new Error('You are offline.')
}

// PostgREST caps a response at 1000 rows by default, so read page by page.
async function fetchAll<T>(client: SupabaseClient, table: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order('created_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data as T[]))
    if (data.length < PAGE_SIZE) return rows
  }
}

export function TasksProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  // Start from the last sync, so the app opens instantly and with no signal.
  const [snapshot] = useState(loadSnapshot)
  const [tasks, setTasks] = useState<Task[]>(snapshot?.tasks ?? [])
  const [series, setSeries] = useState<Series[]>(snapshot?.series ?? [])
  const [labelRows, setLabelRows] = useState<LabelRow[]>(snapshot?.labelRows ?? [])
  const [status, setStatus] = useState<SyncStatus>(snapshot ? 'syncing' : 'loading')
  const [lastSynced, setLastSynced] = useState<Date | null>(snapshot ? new Date(snapshot.syncedAt) : null)
  const [toast, setToast] = useState<string | null>(null)

  const pending = useRef(new Set<string>())
  const deleted = useRef(new Set<string>())
  const latestSync = useRef(0)
  // Bumped by every write and live event, so a fetch that overlapped one is re-read.
  const changes = useRef(0)
  const extending = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const labels = useMemo(() => labelCatalog(labelRows), [labelRows])
  const labelFor = useCallback((key: string) => labelOf(labels, key), [labels])

  const showToast = useCallback((message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const mergeTasks = useCallback((rows: Task[]) => {
    changes.current++
    setTasks((current) => rows.reduce((merged, row) => mergeRow(merged, row), current))
  }, [])

  const removeTasks = useCallback((ids: string[]) => {
    changes.current++
    for (const id of ids) deleted.current.add(id)
    setTasks((current) => current.filter((task) => !ids.includes(task.id)))
  }, [])

  // Creates the next occurrences as real rows. The unique (series_id, scheduled_date)
  // constraint means two devices doing this at once still produce one copy of each.
  const extendSeries = useCallback(
    async (row: Series) => {
      const today = toDateKey(new Date())
      const dates = nextOccurrences(row, today)
      const { title, label, urgency, due_time, remind_minutes } = row
      if (dates.length > 0) {
        const { data, error } = await client
          .from('tasks')
          .upsert(
            dates.map((scheduled_date) => ({
              id: newId(),
              title,
              label,
              urgency,
              due_time,
              remind_minutes,
              scheduled_date,
              series_id: row.id,
            })),
            { onConflict: 'series_id,scheduled_date', ignoreDuplicates: true },
          )
          .select()
        if (error) throw error
        mergeTasks(data as Task[])
      }
      const generated_through = horizonDate(row.recurrence, today)
      const { data, error } = await client
        .from('task_series')
        .update({ generated_through })
        .eq('id', row.id)
        .select()
        .single()
      if (error) throw error
      setSeries((current) => mergeRow(current, data as Series))
    },
    [client, mergeTasks],
  )

  const sync = useCallback(async () => {
    const run = ++latestSync.current
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }
    setStatus((current) => (current === 'loading' ? current : 'syncing'))
    try {
      let rows: Task[] = []
      let seriesRows: Series[] = []
      let customLabels: LabelRow[] = []
      for (let attempt = 0; attempt < 3; attempt++) {
        const seen = changes.current
        ;[rows, seriesRows, customLabels] = await Promise.all([
          fetchAll<Task>(client, 'tasks'),
          fetchAll<Series>(client, 'task_series'),
          fetchAll<LabelRow>(client, 'labels'),
        ])
        if (seen === changes.current) break
      }
      if (run !== latestSync.current) return
      setTasks((current) => reconcile(current, rows, pending.current, deleted.current))
      setSeries(seriesRows)
      setLabelRows(customLabels)
      setStatus('synced')
      setLastSynced(new Date())

      if (!extending.current) {
        extending.current = true
        const today = toDateKey(new Date())
        try {
          for (const row of seriesRows) if (needsExtension(row, today)) await extendSeries(row)
        } catch {
          // Nothing is lost: the next sync picks up where this one stopped.
        } finally {
          extending.current = false
        }
      }
    } catch {
      if (run === latestSync.current) setStatus('offline')
    }
  }, [client, extendSeries])

  useEffect(() => {
    sync()

    // Live updates from other devices.
    const channel = client
      .channel('sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        changes.current++
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Task).id
          setTasks((current) => current.filter((task) => task.id !== id))
          return
        }
        const row = payload.new as Task
        if (!pending.current.has(row.id) && !deleted.current.has(row.id)) {
          setTasks((current) => mergeRow(current, row))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labels' }, (payload) => {
        changes.current++
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as LabelRow).id
          setLabelRows((current) => current.filter((row) => row.id !== id))
        } else {
          setLabelRows((current) => mergeRow(current, payload.new as LabelRow))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_series' }, (payload) => {
        changes.current++
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Series).id
          setSeries((current) => current.filter((row) => row.id !== id))
        } else {
          setSeries((current) => mergeRow(current, payload.new as Series))
        }
      })
      .subscribe((state) => {
        // A socket that just (re)connected may have missed changes while it was down.
        if (state === 'SUBSCRIBED') sync()
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('offline')
      })

    // Phones suspend the socket in the background, so also catch up when the app
    // returns to the foreground, comes back online, and on a slow poll as a fallback.
    const syncIfVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    const goOffline = () => setStatus('offline')
    document.addEventListener('visibilitychange', syncIfVisible)
    window.addEventListener('online', sync)
    window.addEventListener('offline', goOffline)
    const poll = setInterval(syncIfVisible, POLL_MS)

    return () => {
      client.removeChannel(channel)
      document.removeEventListener('visibilitychange', syncIfVisible)
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', goOffline)
      clearInterval(poll)
    }
  }, [client, sync])

  // Only after a sync has succeeded, so an empty first render can't replace a good copy.
  useEffect(() => {
    if (!lastSynced) return
    const timer = setTimeout(() => {
      saveSnapshot({ tasks, series, labelRows, syncedAt: lastSynced.toISOString() })
    }, 300)
    return () => clearTimeout(timer)
  }, [tasks, series, labelRows, lastSynced])

  const saveSeries = useCallback(
    async (id: string, fields: TaskFields, date: string, recurrence: Recurrence) => {
      const { data, error } = await client
        .from('task_series')
        .upsert({ ...fields, id, recurrence, anchor_date: date, generated_through: date }, { onConflict: 'id' })
        .select()
        .single()
      if (error) throw error
      setSeries((current) => mergeRow(current, data as Series))
      return data as Series
    },
    [client],
  )

  // The ids come from the form, so retrying a save whose response was lost updates the
  // same rows in the database instead of creating second copies.
  const createTask = useCallback<TasksContextValue['createTask']>(
    async (ids, fields, date, recurrence) => {
      requireOnline()
      const created = recurrence ? await saveSeries(ids.series, fields, date, recurrence) : null
      const { data, error } = await client
        .from('tasks')
        .upsert({ ...fields, id: ids.task, scheduled_date: date, series_id: created?.id ?? null }, { onConflict: 'id' })
        .select()
        .single()
      if (error) throw error
      mergeTasks([data as Task])
      // The task itself is saved; missing occurrences get created on the next sync.
      if (created) await extendSeries(created).catch(() => {})
    },
    [client, saveSeries, extendSeries, mergeTasks],
  )

  const updateTask = useCallback<TasksContextValue['updateTask']>(
    async (task, fields, date, scope, recurrence) => {
      requireOnline()
      // A changed time or offset is a new reminder, so it should fire again.
      const reminderChanged =
        date !== task.scheduled_date || fields.due_time !== task.due_time || fields.remind_minutes !== task.remind_minutes
      const reminded_at = reminderChanged ? null : task.reminded_at

      if (scope === 'future' && task.series_id) {
        const { data: seriesRow, error: seriesError } = await client
          .from('task_series')
          .update(fields)
          .eq('id', task.series_id)
          .select()
          .single()
        if (seriesError) throw seriesError
        setSeries((current) => mergeRow(current, seriesRow as Series))
        const { data, error } = await client
          .from('tasks')
          .update({ ...fields, reminded_at })
          .eq('series_id', task.series_id)
          .gte('scheduled_date', task.scheduled_date)
          .is('completed_at', null)
          .select()
        if (error) throw error
        mergeTasks(data as Task[])
        return
      }

      let series_id = task.series_id
      let created: Series | null = null
      if (!series_id && recurrence) {
        created = await saveSeries(newId(), fields, date, recurrence)
        series_id = created.id
      } else if (series_id && date !== task.scheduled_date) {
        // A moved occurrence becomes a one-off, so it can't clash with the series' own
        // occurrence on the new date.
        series_id = null
      }
      const { data, error } = await client
        .from('tasks')
        .update({ ...fields, scheduled_date: date, series_id, reminded_at })
        .eq('id', task.id)
        .select()
        .single()
      if (error) throw error
      mergeTasks([data as Task])
      if (created) await extendSeries(created).catch(() => {})
    },
    [client, saveSeries, extendSeries, mergeTasks],
  )

  const deleteFutureOccurrences = useCallback(
    async (seriesId: string, fromDate: string) => {
      const { data, error } = await client
        .from('tasks')
        .delete()
        .eq('series_id', seriesId)
        .gte('scheduled_date', fromDate)
        .is('completed_at', null)
        .select('id')
      if (error) throw error
      removeTasks((data as { id: string }[]).map((row) => row.id))
      const { error: seriesError } = await client.from('task_series').delete().eq('id', seriesId)
      if (seriesError) throw seriesError
      setSeries((current) => current.filter((row) => row.id !== seriesId))
    },
    [client, removeTasks],
  )

  const deleteTask = useCallback<TasksContextValue['deleteTask']>(
    async (task, scope) => {
      requireOnline()
      if (scope === 'future' && task.series_id) await deleteFutureOccurrences(task.series_id, task.scheduled_date)
      const { error } = await client.from('tasks').delete().eq('id', task.id)
      if (error) throw error
      removeTasks([task.id])
    },
    [client, deleteFutureOccurrences, removeTasks],
  )

  // Later occurrences go, this one and everything before it stay.
  const stopRepeating = useCallback<TasksContextValue['stopRepeating']>(
    async (task) => {
      requireOnline()
      if (!task.series_id) return
      await deleteFutureOccurrences(task.series_id, addDays(task.scheduled_date, 1))
      changes.current++
      setTasks((current) => current.map((t) => (t.series_id === task.series_id ? { ...t, series_id: null } : t)))
    },
    [deleteFutureOccurrences],
  )

  const patchOptimistic = useCallback(
    async (task: Task, patch: Partial<Task>, failure: string) => {
      const applyLocal = (values: Partial<Task>) =>
        setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, ...values } : t)))
      const previous = Object.fromEntries(Object.keys(patch).map((key) => [key, task[key as keyof Task]]))

      pending.current.add(task.id)
      applyLocal(patch)
      try {
        requireOnline()
        const { data, error } = await client.from('tasks').update(patch).eq('id', task.id).select().single()
        if (error) throw error
        changes.current++
        pending.current.delete(task.id)
        setTasks((current) => mergeRow(current, data as Task))
      } catch {
        pending.current.delete(task.id)
        applyLocal(previous)
        showToast(failure)
      }
    },
    [client, showToast],
  )

  const setCompleted = useCallback<TasksContextValue['setCompleted']>(
    (task, done) =>
      patchOptimistic(
        task,
        { completed_at: done ? new Date().toISOString() : null },
        "Couldn't save that change. Check your connection and try again.",
      ),
    [patchOptimistic],
  )

  const dismissReminder = useCallback<TasksContextValue['dismissReminder']>(
    (task) =>
      patchOptimistic(
        task,
        { reminded_at: new Date().toISOString() },
        "Couldn't dismiss that reminder. Check your connection and try again.",
      ),
    [patchOptimistic],
  )

  const moveToToday = useCallback<TasksContextValue['moveToToday']>(
    (task) =>
      patchOptimistic(
        task,
        { scheduled_date: toDateKey(new Date()), series_id: null, reminded_at: null },
        "Couldn't move that task. Check your connection and try again.",
      ),
    [patchOptimistic],
  )

  const addLabel = useCallback<TasksContextValue['addLabel']>(
    async (name) => {
      requireOnline()
      const trimmed = name.trim()
      if (labels.some((label) => label.name.toLowerCase() === trimmed.toLowerCase())) throw new Error(DUPLICATE_LABEL)
      const used = labelRows.map((row) => row.slot)
      const slot = CUSTOM_SLOTS.find((candidate) => !used.includes(candidate)) ?? null
      const { data, error } = await client.from('labels').insert({ id: newId(), name: trimmed, slot }).select().single()
      if (error) throw new Error(error.code === UNIQUE_VIOLATION ? DUPLICATE_LABEL : "Couldn't save that label.")
      setLabelRows((current) => mergeRow(current, data as LabelRow))
      return (data as LabelRow).id
    },
    [client, labels, labelRows],
  )

  const renameLabel = useCallback<TasksContextValue['renameLabel']>(
    async (id, name) => {
      requireOnline()
      const trimmed = name.trim()
      if (labels.some((label) => label.key !== id && label.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error(DUPLICATE_LABEL)
      }
      const { data, error } = await client.from('labels').update({ name: trimmed }).eq('id', id).select().single()
      if (error) throw new Error(error.code === UNIQUE_VIOLATION ? DUPLICATE_LABEL : "Couldn't rename that label.")
      setLabelRows((current) => mergeRow(current, data as LabelRow))
    },
    [client, labels],
  )

  // Tasks keep existing and move to Other. If this stops halfway, a task still holding the
  // removed key reads as Other anyway.
  const deleteLabel = useCallback<TasksContextValue['deleteLabel']>(
    async (id) => {
      requireOnline()
      const { data, error } = await client.from('tasks').update({ label: 'other' }).eq('label', id).select()
      if (error) throw error
      mergeTasks(data as Task[])
      const { data: seriesRows, error: seriesError } = await client
        .from('task_series')
        .update({ label: 'other' })
        .eq('label', id)
        .select()
      if (seriesError) throw seriesError
      setSeries((current) => (seriesRows as Series[]).reduce((merged, row) => mergeRow(merged, row), current))
      const { error: labelError } = await client.from('labels').delete().eq('id', id)
      if (labelError) throw labelError
      setLabelRows((current) => current.filter((row) => row.id !== id))
    },
    [client, mergeTasks],
  )

  const value = useMemo(
    () => ({
      tasks,
      series,
      labels,
      labelFor,
      status,
      lastSynced,
      sync,
      createTask,
      updateTask,
      deleteTask,
      stopRepeating,
      moveToToday,
      setCompleted,
      dismissReminder,
      addLabel,
      renameLabel,
      deleteLabel,
      toast,
      showToast,
    }),
    [
      tasks,
      series,
      labels,
      labelFor,
      status,
      lastSynced,
      sync,
      createTask,
      updateTask,
      deleteTask,
      stopRepeating,
      moveToToday,
      setCompleted,
      dismissReminder,
      addLabel,
      renameLabel,
      deleteLabel,
      toast,
      showToast,
    ],
  )

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}

export function useTasks() {
  const value = useContext(TasksContext)
  if (!value) throw new Error('useTasks must be used inside TasksProvider')
  return value
}
