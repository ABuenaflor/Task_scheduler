import { useRegisterSW } from 'virtual:pwa-register/react'
import { useTasks } from '../lib/TasksContext'

function OfflineNotice() {
  const { status, lastSynced } = useTasks()
  if (status !== 'offline') return null
  const when = lastSynced?.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <div className="toast toast-offline">
      Can't reach the database. {when ? `Showing tasks from ${when}. ` : ''}Changes won't save until you reconnect.
    </div>
  )
}

function UpdateNotice() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // An installed app can stay open for weeks, so look for updates when it comes back.
    onRegisteredSW(_url, registration) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) registration?.update().catch(() => {})
      })
    },
  })

  if (!needRefresh) return null
  return (
    <div className="toast toast-update">
      <span>A new version is ready.</span>
      <button type="button" className="btn btn-primary btn-small" onClick={() => updateServiceWorker(true)}>
        Update
      </button>
    </div>
  )
}

export function AppNotices() {
  const { toast } = useTasks()
  return (
    <div className="toast-region" role="status">
      <UpdateNotice />
      <OfflineNotice />
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
