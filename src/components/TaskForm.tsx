import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTasks, type Scope } from '../lib/TasksContext'
import {
  RECURRENCES,
  RECURRENCE_NAMES,
  REMINDER_OPTIONS,
  URGENCIES,
  URGENCY_NAMES,
  type Recurrence,
  type TaskFields,
  type Urgency,
} from '../lib/types'

export interface FormInitial extends TaskFields {
  date: string
  recurrence: Recurrence | null
}

// Only a browser notification needs this; the in-app banner works either way.
function askForNotifications() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

// Time inputs want '14:30'; the database returns '14:30:00'.
const toInputTime = (time: string | null) => time?.slice(0, 5) ?? ''

export function TaskForm({
  initial,
  repeating = false,
  autoFocus = false,
  onSubmit,
  onCancel,
  extraActions,
}: {
  initial: FormInitial
  // This task already belongs to a series: frequency is fixed, and changes get a scope.
  repeating?: boolean
  autoFocus?: boolean
  onSubmit: (fields: TaskFields, date: string, recurrence: Recurrence | null, scope: Scope) => Promise<void>
  onCancel: () => void
  extraActions?: ReactNode
}) {
  const { labels, addLabel } = useTasks()

  const [title, setTitle] = useState(initial.title)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(toInputTime(initial.due_time))
  const [remind, setRemind] = useState<number | null>(initial.remind_minutes)
  const [label, setLabel] = useState(initial.label)
  const [urgency, setUrgency] = useState<Urgency>(initial.urgency)
  const [recurrence, setRecurrence] = useState<Recurrence | null>(initial.recurrence)
  const [scope, setScope] = useState<Scope>('this')

  const [addingLabel, setAddingLabel] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [labelError, setLabelError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  // State only updates on the next render; a ref stops taps landing before that.
  const submitting = useRef(false)
  const [titleError, setTitleError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitLabel = async () => {
    if (!newLabel.trim()) return
    setLabelError(null)
    try {
      setLabel(await addLabel(newLabel))
      setNewLabel('')
      setAddingLabel(false)
    } catch (caught) {
      setLabelError(caught instanceof Error ? caught.message : "Couldn't save that label.")
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current) return
    const trimmed = title.trim()
    setTitleError(!trimmed)
    if (!trimmed || !date) return

    // Browsers only allow this prompt straight from a tap, so it comes before any waiting.
    if (time && remind !== null) askForNotifications()

    submitting.current = true
    setSaving(true)
    setError(null)
    try {
      await onSubmit(
        { title: trimmed, label, urgency, due_time: time || null, remind_minutes: time ? remind : null },
        date,
        recurrence,
        scope,
      )
    } catch {
      setError("Couldn't save your task. Check your connection and try again.")
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <form className="task-form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={title}
          maxLength={200}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder="What do you need to do?"
          aria-invalid={titleError}
          aria-describedby={titleError ? 'title-error' : undefined}
          onChange={(event) => {
            setTitle(event.target.value)
            if (event.target.value.trim()) setTitleError(false)
          }}
        />
        {titleError && (
          <p id="title-error" className="field-error">
            Enter a title for your task.
          </p>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="date">Date</label>
          <input
            id="date"
            type="date"
            required
            value={date}
            disabled={scope === 'future'}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="time">Time (optional)</label>
          <input id="time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="remind">Reminder</label>
        <select
          id="remind"
          disabled={!time}
          value={time && remind !== null ? String(remind) : ''}
          onChange={(event) => setRemind(event.target.value === '' ? null : Number(event.target.value))}
        >
          <option value="">No reminder</option>
          {REMINDER_OPTIONS.map((option) => (
            <option key={option.minutes} value={option.minutes}>
              {option.name}
            </option>
          ))}
        </select>
        <p className="field-hint">
          {time ? 'Reminders appear while the app is open.' : 'Set a time to add a reminder.'}
        </p>
      </div>

      <div className="field">
        <label htmlFor="repeat">Repeat</label>
        <select
          id="repeat"
          disabled={repeating}
          value={recurrence ?? ''}
          onChange={(event) => setRecurrence((event.target.value || null) as Recurrence | null)}
        >
          <option value="">{repeating ? 'Repeats' : 'Does not repeat'}</option>
          {RECURRENCES.map((value) => (
            <option key={value} value={value}>
              {RECURRENCE_NAMES[value]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="field">
        <legend>Label</legend>
        <div className="option-grid">
          {labels.map((value) => (
            <label key={value.key} className="option">
              <input type="radio" name="label" checked={label === value.key} onChange={() => setLabel(value.key)} />
              <span>
                <span className={`dot series-${value.series}`} aria-hidden="true" />
                <span className="option-name">{value.name}</span>
              </span>
            </label>
          ))}
          <button type="button" className="option-add" onClick={() => setAddingLabel(!addingLabel)} aria-expanded={addingLabel}>
            + New label
          </button>
        </div>
        {addingLabel && (
          <div className="inline-add">
            <input
              aria-label="New label name"
              value={newLabel}
              maxLength={30}
              autoFocus
              placeholder="Label name"
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => {
                // Enter here adds the label; it must not submit the whole task.
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submitLabel()
                }
              }}
            />
            <button type="button" className="btn btn-ghost btn-small" onClick={submitLabel}>
              Add
            </button>
          </div>
        )}
        {labelError && <p className="field-error">{labelError}</p>}
      </fieldset>

      <fieldset className="field">
        <legend>Urgency</legend>
        <div className="urgency-grid">
          {URGENCIES.map((value) => (
            <label key={value} className={`option option-urgency urgency-${value}`}>
              <input type="radio" name="urgency" checked={urgency === value} onChange={() => setUrgency(value)} />
              <span>{URGENCY_NAMES[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {repeating && (
        <fieldset className="field">
          <legend>Apply changes to</legend>
          <div className="scope-grid">
            <label className="option">
              <input type="radio" name="scope" checked={scope === 'this'} onChange={() => setScope('this')} />
              <span>This task only</span>
            </label>
            <label className="option">
              <input
                type="radio"
                name="scope"
                checked={scope === 'future'}
                onChange={() => {
                  setScope('future')
                  setDate(initial.date)
                }}
              />
              <span>This and future tasks</span>
            </label>
          </div>
          {scope === 'future' && <p className="field-hint">Dates can only be changed one task at a time.</p>}
        </fieldset>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        {extraActions}
      </div>
    </form>
  )
}
