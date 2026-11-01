import { Link } from 'react-router-dom'
import { CheckIcon } from './Icons'
import { formatShort, formatTime } from '../lib/dates'
import { useTasks } from '../lib/TasksContext'
import { URGENCY_NAMES, type Task } from '../lib/types'

export function LabelChip({ task }: { task: Task }) {
  const { labelFor } = useTasks()
  const label = labelFor(task.label)
  return (
    <span className="chip">
      <span className={`dot series-${label.series}`} aria-hidden="true" />
      {label.name}
    </span>
  )
}

export function TaskCard({
  task,
  showDate = false,
  onMoveToToday,
}: {
  task: Task
  showDate?: boolean
  onMoveToToday?: () => void
}) {
  const { setCompleted } = useTasks()
  const done = task.completed_at !== null
  return (
    <li className={`task-card urgency-${task.urgency}${done ? ' is-done' : ''}`}>
      <button
        type="button"
        className="check"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark "${task.title}" as ${done ? 'not done' : 'done'}`}
        onClick={() => setCompleted(task, !done)}
      >
        <span className="check-box">{done && <CheckIcon />}</span>
      </button>
      <Link className="task-body" to={`/edit/${task.id}`} aria-label={`Edit "${task.title}"`}>
        <p className="task-title">{task.title}</p>
        <div className="task-meta">
          {showDate && <span>{formatShort(task.scheduled_date)}</span>}
          {task.due_time && <span>{formatTime(task.due_time)}</span>}
          <LabelChip task={task} />
          <span className="urgency-tag">{URGENCY_NAMES[task.urgency]} urgency</span>
          {task.series_id && <span>Repeats</span>}
        </div>
      </Link>
      {onMoveToToday && (
        <button type="button" className="btn btn-ghost btn-small move-today" onClick={onMoveToToday}>
          Move to today
        </button>
      )}
    </li>
  )
}
