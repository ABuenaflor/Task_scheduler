import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BackIcon } from '../components/Icons'
import { TaskCard } from '../components/TaskCard'
import { useGoBack, useToday } from '../lib/hooks'
import { searchTasks, type SearchFilters } from '../lib/stats'
import { useTasks } from '../lib/TasksContext'
import { URGENCIES, URGENCY_NAMES, type Urgency } from '../lib/types'

const MAX_RESULTS = 100
const STATUSES: { value: SearchFilters['status']; name: string }[] = [
  { value: 'all', name: 'All' },
  { value: 'open', name: 'To do' },
  { value: 'done', name: 'Done' },
]

export function SearchPage() {
  const goBack = useGoBack()
  const today = useToday()
  const { tasks, labels } = useTasks()

  // Filters live in the URL, so coming back from editing a result keeps them.
  const [params, setParams] = useSearchParams()
  const filters: SearchFilters = {
    query: params.get('q') ?? '',
    label: params.get('label'),
    urgency: params.get('urgency') as Urgency | null,
    status: (params.get('status') as SearchFilters['status'] | null) ?? 'all',
  }
  const setParam = (key: string, value: string | null) => {
    // Read from the address bar, not `params`: that only updates on the next render, so a
    // quick second tap would otherwise undo the first filter.
    const next = new URLSearchParams(window.location.search)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const results = useMemo(
    () => searchTasks(tasks, filters, today),
    [tasks, today, filters.query, filters.label, filters.urgency, filters.status],
  )

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={goBack}>
          <BackIcon />
        </button>
        <div className="topbar-title">
          <h1>Search</h1>
        </div>
        <span className="icon-btn-spacer" />
      </header>

      <main className="content">
        <div className="field">
          <input
            type="search"
            aria-label="Search tasks"
            placeholder="Search by title"
            autoFocus
            value={filters.query}
            onChange={(event) => setParam('q', event.target.value || null)}
          />
        </div>

        <div className="filter-row" role="group" aria-label="Status">
          {STATUSES.map((status) => (
            <button
              key={status.value}
              type="button"
              className="filter-chip"
              aria-pressed={filters.status === status.value}
              onClick={() => setParam('status', status.value === 'all' ? null : status.value)}
            >
              {status.name}
            </button>
          ))}
        </div>

        <div className="filter-row" role="group" aria-label="Urgency">
          {URGENCIES.map((urgency) => (
            <button
              key={urgency}
              type="button"
              className={`filter-chip urgency-${urgency}`}
              aria-pressed={filters.urgency === urgency}
              onClick={() => setParam('urgency', filters.urgency === urgency ? null : urgency)}
            >
              <span className="urgency-dot" aria-hidden="true" />
              {URGENCY_NAMES[urgency]}
            </button>
          ))}
        </div>

        <div className="filter-row" role="group" aria-label="Label">
          {labels.map((label) => (
            <button
              key={label.key}
              type="button"
              className="filter-chip"
              aria-pressed={filters.label === label.key}
              onClick={() => setParam('label', filters.label === label.key ? null : label.key)}
            >
              <span className={`dot series-${label.series}`} aria-hidden="true" />
              {label.name}
            </button>
          ))}
        </div>

        <p className="progress-text results-count" role="status">
          {results.length === 0
            ? 'No matching tasks'
            : results.length > MAX_RESULTS
              ? `Showing the newest ${MAX_RESULTS} of ${results.length} tasks`
              : `${results.length} ${results.length === 1 ? 'task' : 'tasks'}`}
        </p>

        <ul className="task-list">
          {results.slice(0, MAX_RESULTS).map((task) => (
            <TaskCard key={task.id} task={task} showDate />
          ))}
        </ul>
      </main>
    </div>
  )
}
