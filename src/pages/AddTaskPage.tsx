import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BackIcon } from '../components/Icons'
import { TaskForm } from '../components/TaskForm'
import { formatShort } from '../lib/dates'
import { useGoBack, useToday } from '../lib/hooks'
import { newId } from '../lib/ids'
import { useTasks } from '../lib/TasksContext'

export function AddTaskPage() {
  const goBack = useGoBack()
  const today = useToday()
  const [params] = useSearchParams()
  const { createTask, showToast } = useTasks()

  // One set of ids per form: retries after a failed save can never create a second task.
  const ids = useRef({ task: newId(), series: newId() })

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={goBack}>
          <BackIcon />
        </button>
        <div className="topbar-title">
          <h1>Add task</h1>
        </div>
        <span className="icon-btn-spacer" />
      </header>

      <main className="content">
        <TaskForm
          autoFocus
          initial={{
            title: '',
            date: params.get('date') ?? today,
            label: 'personal',
            urgency: 'low',
            due_time: null,
            remind_minutes: null,
            recurrence: null,
          }}
          onCancel={goBack}
          onSubmit={async (fields, date, recurrence) => {
            await createTask(ids.current, fields, date, recurrence)
            if (date !== today) showToast(`Scheduled for ${formatShort(date)}`)
            goBack()
          }}
        />
      </main>
    </div>
  )
}
