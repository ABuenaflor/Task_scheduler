import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// createClient throws on a malformed URL. Treat that like a missing one, so a typo in the
// settings shows the setup screen instead of a blank page.
function connect(): SupabaseClient | null {
  if (!url || !key) return null
  try {
    // There is no sign-in, so no session to keep or renew.
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  } catch {
    return null
  }
}

export const supabase = connect()
