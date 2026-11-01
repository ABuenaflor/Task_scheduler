import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { clearOfflineData } from './offline'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// createClient throws on a malformed URL. Treat that like a missing one, so a typo in the
// settings shows the setup screen instead of a blank page.
function connect(): SupabaseClient | null {
  if (!url || !key) return null
  try {
    return createClient(url, key)
  } catch {
    return null
  }
}

export const supabase = connect()

export async function signOut() {
  // With no signal Supabase can stall on retries and then refuse, leaving the session in
  // place. Signing out must still work on this device, so remove it directly. The token
  // expires by itself.
  if (navigator.onLine) {
    const result = await supabase?.auth.signOut()
    if (!result?.error) return
  }
  try {
    for (const storageKey of Object.keys(localStorage)) {
      if (/^sb-.*-auth-token/.test(storageKey)) localStorage.removeItem(storageKey)
    }
  } catch {
    // Storage is blocked, so there is nothing stored to remove.
  }
  clearOfflineData()
  window.location.replace('/')
}
