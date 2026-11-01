import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BackIcon, PlusIcon } from '../components/Icons'
import { TaskCard } from '../components/TaskCard'
import { formatLong, parseDateKey } from '../lib/dates'
import { useGoBack } from '../lib/hooks'
import { sortForToday } from '../lib/stats'
import { useTasks } from '../lib/TasksContext'

export function DayPage() {
  const { date = '' } = useParams()
  const goBack = useGoBack()
  const { tasks, status } = useTasks()

  const dayTasks = useMemo(() => sortForToday(tasks.filter((task) => task.scheduled_date === date)), [tasks, date])

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parseDateKey(date).getTime())) {
    return <Navigate to="/calendar" replace />
  }

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={goBack}>
          <BackIcon />
        </button>
        <div className="topbar-title">
          <h1>{formatLong(date)}</h1>
        </div>
        <span className="icon-btn-spacer" />
      </header>

      <main className="content">
        {status === 'loading' ? (
          <p className="empty-note">Loading…</p>
        ) : dayTasks.length === 0 ? (
          <div className="empty-state">
            <h2>Nothing scheduled</h2>
            <p>Tap the + button to add a task on this day.</p>
          </div>
        ) : (
          <ul className="task-list">
            {dayTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </ul>
        )}
      </main>

      <Link className="fab" to={`/add?date=${date}`} aria-label="Add task on this day">
        <PlusIcon />
      </Link>
    </div>
  )
}
