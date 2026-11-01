import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

// The browser fires this once, possibly before any screen that wants it has rendered,
// so it is caught as soon as this module loads.
let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferred = event as InstallPromptEvent
  notify()
})

window.addEventListener('appinstalled', () => {
  deferred = null
  notify()
})

function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

// iPhones have no install prompt; there the steps have to be shown instead. iPads can
// report themselves as Macs, which the touch check catches.
function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

export type InstallOption = { kind: 'prompt'; install: () => void } | { kind: 'ios' } | { kind: 'none' }

export function useInstallOption(): InstallOption {
  const [, rerender] = useState(0)
  useEffect(() => {
    const listener = () => rerender((n) => n + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  if (isInstalled()) return { kind: 'none' }
  if (isIos()) return { kind: 'ios' }
  if (!deferred) return { kind: 'none' }
  const event = deferred
  return {
    kind: 'prompt',
    install: () => {
      // A prompt can only be used once.
      deferred = null
      notify()
      event.prompt().catch(() => {})
    },
  }
}
