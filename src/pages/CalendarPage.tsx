import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BackIcon, NextIcon } from '../components/Icons'
import { LabelChip } from '../components/TaskCard'
import { formatFull, formatLong, monthGrid, parseDateKey } from '../lib/dates'
import { useToday } from '../lib/hooks'
import { accomplishedByDay, countByDate, loadLevel } from '../lib/stats'
import { useTasks } from '../lib/TasksContext'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarPage() {
  const { tasks, status } = useTasks()
  const today = useToday()
  const [view, setView] = useState(() => {
    const date = parseDateKey(today)
    return { year: date.getFullYear(), month: date.getMonth() }
  })

  const counts = useMemo(() => countByDate(tasks), [tasks])
  const accomplished = useMemo(() => accomplishedByDay(tasks), [tasks])
  const grid = monthGrid(view.year, view.month)
  const monthName = new Date(view.year, view.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const shiftMonth = (by: number) => {
    const date = new Date(view.year, view.month + by, 1)
    setView({ year: date.getFullYear(), month: date.getMonth() })
  }

  return (
    <div className="page">
      <header className="topbar">
        <Link className="icon-btn" to="/" aria-label="Back to today">
          <BackIcon />
        </Link>
        <div className="topbar-title">
          <h1>Calendar</h1>
        </div>
        <span className="icon-btn-spacer" />
      </header>

      <main className="content">
        <section className="card calendar" aria-label="Tasks per day">
          <div className="month-nav">
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <BackIcon />
            </button>
            <h2 aria-live="polite">{monthName}</h2>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shiftMonth(1)}>
              <NextIcon />
            </button>
          </div>

          <div className="weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="month-grid" key={monthName}>
            {grid.map((key, i) => {
              if (!key) return <span key={`blank-${i}`} className="tile tile-blank" />
              const count = counts[key] ?? 0
              return (
                <Link
                  key={key}
                  to={`/day/${key}`}
                  className={`tile load-${loadLevel(count)}${key === today ? ' is-today' : ''}`}
                  aria-label={`${formatLong(key)}: ${count} ${count === 1 ? 'task' : 'tasks'}`}
                >
                  <span className="tile-day">{parseDateKey(key).getDate()}</span>
                  {count > 0 && <span className="tile-count">{count}</span>}
                </Link>
              )
            })}
          </div>

          <ul className="load-legend">
            <li>
              <span className="swatch load-low" aria-hidden="true" /> 1–2 tasks
            </li>
            <li>
              <span className="swatch load-medium" aria-hidden="true" /> 3–4 tasks
            </li>
            <li>
              <span className="swatch load-high" aria-hidden="true" /> 5+ tasks
            </li>
          </ul>
        </section>

        <section className="accomplished">
          <h2>Accomplished tasks</h2>
          {status === 'loading' ? (
            <p className="empty-note">Loading…</p>
          ) : accomplished.length === 0 ? (
            <p className="empty-note">Tasks you complete will be listed here with the date you finished them.</p>
          ) : (
            accomplished.map((group) => (
              <div key={group.date} className="done-group">
                <h3>{formatFull(group.date)}</h3>
                <ul>
                  {group.tasks.map((task) => (
                    <li key={task.id}>
                      <Link className="done-item" to={`/edit/${task.id}`}>
                        <span className="done-title">{task.title}</span>
                        <LabelChip task={task} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  )
}
