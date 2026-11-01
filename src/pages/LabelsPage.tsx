import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { BackIcon } from '../components/Icons'
import { useGoBack } from '../lib/hooks'
import { useTasks } from '../lib/TasksContext'
import type { LabelInfo } from '../lib/types'

function CustomLabelRow({ label, onDelete }: { label: LabelInfo; onDelete: () => void }) {
  const { renameLabel, showToast } = useTasks()
  const [name, setName] = useState(label.name)
  const [error, setError] = useState<string | null>(null)
  const changed = name.trim() !== '' && name.trim() !== label.name

  const save = async () => {
    setError(null)
    try {
      await renameLabel(label.key, name)
      showToast('Label renamed')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't rename that label.")
    }
  }

  return (
    <li className="label-row">
      <div className="label-row-main">
        <span className={`dot series-${label.series}`} aria-hidden="true" />
        <input
          aria-label={`Name of label ${label.name}`}
          value={name}
          maxLength={30}
          onChange={(event) => setName(event.target.value)}
        />
        {changed && (
          <button type="button" className="btn btn-primary btn-small" onClick={save}>
            Save
          </button>
        )}
        <button type="button" className="btn btn-danger-ghost btn-small" onClick={onDelete}>
          Delete
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </li>
  )
}

export function LabelsPage() {
  const goBack = useGoBack()
  const { labels, tasks, addLabel, deleteLabel, showToast } = useTasks()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<LabelInfo | null>(null)

  const custom = labels.filter((label) => label.custom)
  const builtin = labels.filter((label) => !label.custom)
  const inUse = deleting ? tasks.filter((task) => task.label === deleting.key).length : 0

  const add = async () => {
    if (!name.trim()) return
    setError(null)
    try {
      await addLabel(name)
      setName('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save that label.")
    }
  }

  const runDelete = async () => {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    try {
      await deleteLabel(target.key)
      showToast(`Deleted ${target.name}`)
    } catch {
      showToast("Couldn't delete that label. Check your connection and try again.")
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={goBack}>
          <BackIcon />
        </button>
        <div className="topbar-title">
          <h1>Labels</h1>
        </div>
        <span className="icon-btn-spacer" />
      </header>

      <main className="content labels-page">
        <form
          className="inline-add"
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}
        >
          <input
            aria-label="New label name"
            placeholder="New label name"
            maxLength={30}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-small">
            Add
          </button>
        </form>
        {error && <p className="field-error">{error}</p>}

        <section>
          <h2>Your labels</h2>
          {custom.length === 0 ? (
            <p className="empty-note">You haven't added any labels yet.</p>
          ) : (
            <ul className="label-list">
              {custom.map((label) => (
                <CustomLabelRow key={label.key} label={label} onDelete={() => setDeleting(label)} />
              ))}
            </ul>
          )}
          {custom.length > 2 && (
            <p className="field-hint">Your first two labels get their own chart colour. Later ones are grouped with Other in the weekly chart.</p>
          )}
        </section>

        <section>
          <h2>Built-in labels</h2>
          <ul className="builtin-list">
            {builtin.map((label) => (
              <li key={label.key} className="chip">
                <span className={`dot series-${label.series}`} aria-hidden="true" />
                {label.name}
              </li>
            ))}
          </ul>
        </section>
      </main>

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          body={
            inUse > 0
              ? `${inUse} ${inUse === 1 ? 'task uses' : 'tasks use'} this label and will move to Other.`
              : 'No tasks use this label.'
          }
          actions={[{ name: 'Delete label', danger: true, run: runDelete }]}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
