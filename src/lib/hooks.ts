import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toDateKey } from './dates'

// Today's date key, kept current if the app stays open past midnight.
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()))
  useEffect(() => {
    const check = () => setToday(toDateKey(new Date()))
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}

// The current time, refreshed often enough for reminders to feel on time.
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const check = () => setNow(Date.now())
    const timer = setInterval(check, intervalMs)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [intervalMs])
  return now
}

// Back to the previous screen, or home if this page was opened directly.
export function useGoBack(): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if (location.key === 'default') navigate('/', { replace: true })
    else navigate(-1)
  }
}

export type Theme = 'light' | 'dark'

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
    setTheme(next)
  }
  return [theme, toggle]
}

// Measured width of an element, so charts draw at real pixels and text never scales.
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}
