import { useEffect, useState } from 'react'
import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppNotices } from './components/AppNotices'
import { ReminderBanner } from './components/ReminderBanner'
import { AddTaskPage } from './pages/AddTaskPage'
import { CalendarPage } from './pages/CalendarPage'
import { DayPage } from './pages/DayPage'
import { EditTaskPage } from './pages/EditTaskPage'
import { HomePage } from './pages/HomePage'
import { LabelsPage } from './pages/LabelsPage'
import { PasscodePage } from './pages/PasscodePage'
import { SearchPage } from './pages/SearchPage'
import { SetupNeeded } from './pages/SetupNeeded'
import { clearOfflineData, loadIdentity, saveIdentity, type Identity } from './lib/offline'
import { OWNER_EMAIL, supabase } from './lib/supabase'
import { TasksProvider } from './lib/TasksContext'

function Authenticated({ client }: { client: SupabaseClient }) {
  // Open straight away if someone was signed in here. Checking the session can take up to
  // half a minute of retries with no signal, and the check below still has the last word.
  const [identity, setIdentity] = useState<Identity | null | undefined>(() => loadIdentity() ?? undefined)

  useEffect(() => {
    const signedIn = (id: string, email?: string) => {
      // A device can still hold a session from before the passcode existed.
      if (email !== OWNER_EMAIL) {
        client.auth.signOut({ scope: 'local' })
        return
      }
      const next = { id }
      saveIdentity(next)
      setIdentity(next)
    }

    client.auth.getSession().then(({ data, error }) => {
      if (data.session) signedIn(data.session.user.id, data.session.user.email)
      // Sessions last an hour, and renewing an expired one needs a connection. Having no
      // signal isn't being signed out, so keep the app usable; it renews when back online.
      else if (error && isAuthRetryableFetchError(error)) setIdentity(loadIdentity())
      else {
        clearOfflineData()
        setIdentity(null)
      }
    })

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearOfflineData()
        setIdentity(null)
      } else if (session) {
        signedIn(session.user.id, session.user.email)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  if (identity === undefined) return null
  if (!identity) return <PasscodePage client={client} />

  return (
    // Keyed by user so nothing from one account can linger after switching to another.
    <TasksProvider key={identity.id} client={client} userId={identity.id}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/add" element={<AddTaskPage />} />
          <Route path="/edit/:id" element={<EditTaskPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/day/:date" element={<DayPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/labels" element={<LabelsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ReminderBanner />
      <AppNotices />
    </TasksProvider>
  )
}

export function App() {
  return supabase ? <Authenticated client={supabase} /> : <SetupNeeded />
}
