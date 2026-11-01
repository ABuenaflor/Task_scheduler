import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarIcon, MenuIcon, PlusIcon, SearchIcon } from '../components/Icons'
import { SideNav } from '../components/SideNav'
import { TaskCard } from '../components/TaskCard'
import { formatLong } from '../lib/dates'
import { useToday } from '../lib/hooks'
import { overdueTasks, sortForToday } from '../lib/stats'
import { useTasks } from '../lib/TasksContext'

export function HomePage() {
  const { tasks, status, moveToToday } = useTasks()
  const today = useToday()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()

  const todays = useMemo(() => sortForToday(tasks.filter((task) => task.scheduled_date === today)), [tasks, today])
  const overdue = useMemo(() => overdueTasks(tasks, today), [tasks, today])
  const doneCount = todays.filter((task) => task.completed_at).length

  // The drawer lives in the URL so the phone's back button closes it.
  const menuOpen = params.has('menu')
  const closeMenu = () => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1))

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Open menu and insights" onClick={() => navigate('/?menu=1')}>
          <MenuIcon />
        </button>
        <div className="topbar-title topbar-title-left">
          <h1>Today</h1>
          <p>{formatLong(today)}</p>
        </div>
        <Link className="icon-btn" to="/search" aria-label="Search tasks">
          <SearchIcon />
        </Link>
        <Link className="icon-btn" to="/calendar" aria-label="Open calendar">
          <CalendarIcon />
        </Link>
      </header>

      <main className="content">
        {status === 'loading' ? (
          <p className="empty-note">Loading your tasks…</p>
        ) : (
          <>
            {overdue.length > 0 && (
              <section className="overdue" aria-labelledby="overdue-heading">
                <h2 id="overdue-heading">Overdue ({overdue.length})</h2>
                <ul className="task-list">
                  {overdue.map((task) => (
                    <TaskCard key={task.id} task={task} showDate onMoveToToday={() => moveToToday(task)} />
                  ))}
                </ul>
              </section>
            )}

            {todays.length === 0 ? (
              <div className="empty-state">
                <h2>Nothing scheduled today</h2>
                <p>Tap the + button to add a task.</p>
              </div>
            ) : (
              <>
                <p className="progress-text">
                  {doneCount} of {todays.length} done
                </p>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label="Tasks done today"
                  aria-valuemin={0}
                  aria-valuemax={todays.length}
                  aria-valuenow={doneCount}
                >
                  <span style={{ width: `${(doneCount / todays.length) * 100}%` }} />
                </div>
                <ul className="task-list">
                  {todays.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </main>

      <Link className="fab" to="/add" aria-label="Add task">
        <PlusIcon />
      </Link>

      {menuOpen && <SideNav onClose={closeMenu} />}
    </div>
  )
}
