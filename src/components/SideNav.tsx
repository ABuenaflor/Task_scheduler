import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryBars, TrendLine, WeeklyStack } from './Charts'
import { CloseIcon, MoonIcon, SunIcon } from './Icons'
import { useTheme, useToday } from '../lib/hooks'
import { analytics } from '../lib/stats'
import { useInstallOption } from '../lib/install'
import { signOut } from '../lib/supabase'
import { useTasks } from '../lib/TasksContext'

const RANGES = [7, 30, 90]
const CLOSE_MS = 180

function syncText(status: string, lastSynced: Date | null): string {
  if (status === 'offline') return 'Offline. Changes will not save until you reconnect.'
  if (status === 'loading' || status === 'syncing') return 'Syncing…'
  const time = lastSynced?.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `Synced at ${time}`
}

export function SideNav({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const closing = useRef(false)
  const [isClosing, setIsClosing] = useState(false)
  const [days, setDays] = useState(30)
  const [theme, toggleTheme] = useTheme()
  const today = useToday()
  const installOption = useInstallOption()
  const { tasks, labels, status, lastSynced, sync } = useTasks()

  const stats = useMemo(() => analytics(tasks, today, days, labels), [tasks, today, days, labels])

  // showModal gives focus trapping, Esc to close and an inert page behind for free.
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const close = () => {
    if (closing.current) return
    closing.current = true
    setIsClosing(true)
    setTimeout(onClose, CLOSE_MS)
  }

  return (
    <dialog
      ref={ref}
      className={`drawer${isClosing ? ' is-closing' : ''}`}
      aria-label="Menu and insights"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === ref.current) close()
      }}
    >
      <div className="drawer-inner">
        <header className="drawer-head">
          <h2>Insights</h2>
          <button type="button" className="icon-btn" aria-label="Close menu" onClick={close}>
            <CloseIcon />
          </button>
        </header>

        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button
              type="button"
              key={range}
              aria-pressed={days === range}
              className={days === range ? 'is-active' : ''}
              onClick={() => setDays(range)}
            >
              {range} days
            </button>
          ))}
        </div>

        <div className="figures">
          <div>
            <p className="hero-figure">{stats.total.toLocaleString()}</p>
            <p className="figure-label">Tasks accomplished</p>
          </div>
          <div>
            <p className="stat-figure">{stats.completionRate === null ? '–' : `${Math.round(stats.completionRate * 100)}%`}</p>
            <p className="figure-label">Completion rate</p>
          </div>
        </div>

        {stats.total === 0 ? (
          <p className="empty-note">No tasks accomplished in the last {days} days. Check some off and your charts will appear here.</p>
        ) : (
          <>
            <CategoryBars data={stats.byLabel} />
            <TrendLine data={stats.trend} />
            <WeeklyStack data={stats.weekly} series={stats.series} />
          </>
        )}

        <footer className="drawer-foot">
          {installOption.kind === 'prompt' && (
            <div className="setting-row">
              <span>Use it like a normal app</span>
              <button type="button" className="btn btn-primary btn-small" onClick={installOption.install}>
                Install app
              </button>
            </div>
          )}
          {installOption.kind === 'ios' && (
            <p className="field-hint">To install: in Safari, tap Share, then Add to Home Screen.</p>
          )}
          <div className="setting-row">
            <span>Labels</span>
            <Link className="btn btn-ghost btn-small" to="/labels" replace>
              Manage labels
            </Link>
          </div>
          <div className="setting-row">
            <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
            <button type="button" className="btn btn-ghost btn-small" onClick={toggleTheme}>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              Switch to {theme === 'dark' ? 'light' : 'dark'}
            </button>
          </div>
          <div className="setting-row">
            <span className={`sync-state sync-${status}`} role="status">
              {syncText(status, lastSynced)}
            </span>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => sync()}>
              Sync now
            </button>
          </div>
          <div className="setting-row">
            <span>Ask for the passcode on this device</span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => {
                // Clear ?menu=1 so the drawer doesn't reopen after the next unlock.
                window.history.replaceState(null, '', '/')
                signOut()
              }}
            >
              Lock app
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  )
}
