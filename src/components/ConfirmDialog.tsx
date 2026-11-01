import { useEffect, useRef } from 'react'

export interface ConfirmAction {
  name: string
  danger?: boolean
  run: () => void
}

export function ConfirmDialog({
  title,
  body,
  actions,
  onCancel,
}: {
  title: string
  body: string
  actions: ConfirmAction[]
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <p>{body}</p>
      <div className="confirm-actions">
        {actions.map((action) => (
          <button
            key={action.name}
            type="button"
            className={`btn ${action.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={action.run}
          >
            {action.name}
          </button>
        ))}
        <button type="button" className="btn btn-ghost" autoFocus onClick={onCancel}>
          Cancel
        </button>
      </div>
    </dialog>
  )
}
