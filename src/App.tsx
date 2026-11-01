import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppNotices } from './components/AppNotices'
import { ReminderBanner } from './components/ReminderBanner'
import { AddTaskPage } from './pages/AddTaskPage'
import { CalendarPage } from './pages/CalendarPage'
import { DayPage } from './pages/DayPage'
import { EditTaskPage } from './pages/EditTaskPage'
import { HomePage } from './pages/HomePage'
import { LabelsPage } from './pages/LabelsPage'
import { SearchPage } from './pages/SearchPage'
import { SetupNeeded } from './pages/SetupNeeded'
import { supabase } from './lib/supabase'
import { TasksProvider } from './lib/TasksContext'

export function App() {
  if (!supabase) return <SetupNeeded />

  return (
    <TasksProvider client={supabase}>
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
