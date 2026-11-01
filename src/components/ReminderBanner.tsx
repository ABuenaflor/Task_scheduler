import { useEffect, useMemo, useRef } from 'react'
import { formatShort, formatTime, toDateKey } from '../lib/dates'
import { useNow } from '../lib/hooks'
import { activeReminders, reminderTime } from '../lib/stats'
import { useTasks } from '../lib/TasksContext'
import type { Task } from '../lib/types'

// Each device raises its own browser notification once, even after a reload.
function alreadyNotified(key: string, session: Set<string>): boolean {
  if (session.has(key)) return true
  session.add(key)
  try {
    if (localStorage.getItem(key)) return true
    localStorage.setItem(key, '1')
  } catch {
    // Storage can be blocked; this session's memory still prevents repeats.
  }
  return false
}

// Not every browser supports this, or allows it. The banner below is what guarantees
// the reminder is seen.
async function notify(task: Task) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const options = {
      body: task.due_time ? `Due at ${formatTime(task.due_time)}` : undefined,
      icon: '/icons/icon-192.png',
      tag: task.id,
    }
    // Android only accepts notifications sent through the service worker.
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) await registration.showNotification(task.title, options)
    else new Notification(task.title, options).onclick = () => window.focus()
  } catch {
    // The banner still shows.
  }
}

export function ReminderBanner() {
  const { tasks, setCompleted, dismissReminder } = useTasks()
  const now = useNow()
  const session = useRef(new Set<string>())

  const reminders = useMemo(() => activeReminders(tasks, now), [tasks, now])

  useEffect(() => {
    for (const task of reminders) {
      if (!alreadyNotified(`notified:${task.id}:${reminderTime(task)}`, session.current)) notify(task)
    }
  }, [reminders])

  if (reminders.length === 0) return null

  const today = toDateKey(new Date(now))
  return (
    <div className="reminders" role="status">
      {reminders.map((task) => (
        <div key={task.id} className="reminder">
          <div className="reminder-text">
            <strong>{task.title}</strong>
            <span>
              {task.scheduled_date === today ? 'Today' : formatShort(task.scheduled_date)} at {formatTime(task.due_time!)}
            </span>
          </div>
          <div className="reminder-actions">
            <button type="button" className="btn btn-primary btn-small" onClick={() => setCompleted(task, true)}>
              Done
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => dismissReminder(task)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
