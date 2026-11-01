import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConfirmDialog, type ConfirmAction } from '../components/ConfirmDialog'
import { BackIcon } from '../components/Icons'
import { TaskForm } from '../components/TaskForm'
import { formatFull, formatShort, toDateKey } from '../lib/dates'
import { useGoBack } from '../lib/hooks'
import { useTasks, type Scope } from '../lib/TasksContext'
import { RECURRENCE_NAMES } from '../lib/types'

export function EditTaskPage() {
  const { id } = useParams()
  const goBack = useGoBack()
  const { tasks, series, status, updateTask, deleteTask, stopRepeating, showToast } = useTasks()
  const [confirm, setConfirm] = useState<'delete' | 'stop' | null>(null)
  const leaving = useRef(false)

  const task = tasks.find((row) => row.id === id)
  const parent = task?.series_id ? series.find((row) => row.id === task.series_id) : undefined

  const header = (
    <header className="topbar">
      <button type="button" className="icon-btn" aria-label="Back" onClick={goBack}>
        <BackIcon />
      </button>
      <div className="topbar-title">
        <h1>Edit task</h1>
      </div>
      <span className="icon-btn-spacer" />
    </header>
  )

  if (!task) {
    // Just deleted here and on the way back, so "no longer exists" would only flash.
    if (leaving.current) return null
    return (
      <div className="page">
        {header}
        <main className="content">
          {status === 'loading' ? (
            <p className="empty-note">Loading…</p>
          ) : (
            <div className="empty-state">
              <h2>This task no longer exists</h2>
              <p>
                It may have been deleted on another device. <Link to="/">Back to today</Link>
              </p>
            </div>
          )}
        </main>
      </div>
    )
  }

  const repeating = task.series_id !== null

  const runDelete = async (scope: Scope) => {
    setConfirm(null)
    leaving.current = true
    try {
      await deleteTask(task, scope)
      showToast('Task deleted')
      goBack()
    } catch {
      leaving.current = false
      showToast("Couldn't delete that task. Check your connection and try again.")
    }
  }

  const runStop = async () => {
    setConfirm(null)
    try {
      await stopRepeating(task)
      showToast('This task will no longer repeat')
    } catch {
      showToast("Couldn't stop that task repeating. Check your connection and try again.")
    }
  }

  const deleteActions: ConfirmAction[] = repeating
    ? [
        { name: 'Delete this task only', danger: true, run: () => runDelete('this') },
        { name: 'Delete this and future tasks', danger: true, run: () => runDelete('future') },
      ]
    : [{ name: 'Delete', danger: true, run: () => runDelete('this') }]

  return (
    <div className="page">
      {header}
      <main className="content">
        {task.completed_at && (
          <p className="form-notice done-note">Accomplished {formatFull(toDateKey(new Date(task.completed_at)))}</p>
        )}
        <TaskForm
          // Rebuilt when the row's repeat state changes, so the form never shows a stale series.
          key={`${task.id}:${repeating}`}
          repeating={repeating}
          initial={{
            title: task.title,
            date: task.scheduled_date,
            label: task.label,
            urgency: task.urgency,
            due_time: task.due_time,
            remind_minutes: task.remind_minutes,
            recurrence: parent?.recurrence ?? null,
          }}
          onCancel={goBack}
          onSubmit={async (fields, date, recurrence, scope) => {
            await updateTask(task, fields, date, scope, recurrence)
            if (date !== task.scheduled_date) showToast(`Moved to ${formatShort(date)}`)
            goBack()
          }}
          extraActions={
            <>
              {repeating && (
                <button type="button" className="btn btn-ghost" onClick={() => setConfirm('stop')}>
                  Stop repeating
                </button>
              )}
              <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirm('delete')}>
                Delete task
              </button>
            </>
          }
        />
      </main>

      {confirm === 'delete' && (
        <ConfirmDialog
          title="Delete this task?"
          body={repeating ? 'This task repeats. Tasks you already accomplished are always kept.' : 'This cannot be undone.'}
          actions={deleteActions}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'stop' && (
        <ConfirmDialog
          title="Stop repeating?"
          body={`${parent ? `${RECURRENCE_NAMES[parent.recurrence]}: all` : 'All'} later tasks that aren't done yet will be removed. This task stays.`}
          actions={[{ name: 'Stop repeating', danger: true, run: runStop }]}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
