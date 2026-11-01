import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

const LENGTH = 4
type Step = 'checking' | 'create' | 'confirm' | 'unlock' | 'unavailable'

const HEADINGS: Record<Step, string> = {
  checking: 'Task Scheduler',
  create: 'Create a 4-digit passcode',
  confirm: 'Enter it again',
  unlock: 'Enter your passcode',
  unavailable: 'Task Scheduler',
}

type UnlockResult =
  | { status: 'ok'; email: string; secret: string }
  | { status: 'wrong'; attempts_left: number }
  | { status: 'locked'; locked_until: string }
  | { status: 'not_set' }

export function PasscodePage({ client }: { client: SupabaseClient }) {
  const [step, setStep] = useState<Step>('checking')
  const [code, setCode] = useState('')
  const [firstEntry, setFirstEntry] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = async () => {
    setStep('checking')
    setError(null)
    const { data, error: failure } = await client.rpc('passcode_is_set')
    if (failure) {
      setStep('unavailable')
      setError("Can't reach the database. Check your connection and try again.")
    } else {
      setStep(data ? 'unlock' : 'create')
    }
  }

  useEffect(() => {
    check()
    // Runs once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A successful sign-in is picked up by the auth listener in App, which leaves this page.
  const signIn = async (email: string, secret: string) => {
    const { error: failure } = await client.auth.signInWithPassword({ email, password: secret })
    if (failure) throw failure
  }

  const create = async (value: string) => {
    const { data, error: failure } = await client.rpc('create_passcode', { code: value })
    if (failure) {
      // Someone else's device got there first.
      if (failure.message.includes('already exists')) {
        setStep('unlock')
        setError('A passcode already exists. Enter it to continue.')
        return
      }
      throw failure
    }
    await signIn(data.email, data.secret)
  }

  const unlock = async (value: string) => {
    const { data, error: failure } = await client.rpc('unlock_with_passcode', { code: value })
    if (failure) throw failure
    const result = data as UnlockResult
    if (result.status === 'ok') {
      await signIn(result.email, result.secret)
    } else if (result.status === 'wrong') {
      setError(`Wrong passcode. ${result.attempts_left} ${result.attempts_left === 1 ? 'try' : 'tries'} left.`)
    } else if (result.status === 'locked') {
      const until = new Date(result.locked_until).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
      setError(`Too many wrong tries. Try again after ${until}.`)
    } else {
      setStep('create')
    }
  }

  const submit = async (value: string) => {
    setCode('')
    setError(null)
    if (step === 'create') {
      setFirstEntry(value)
      setStep('confirm')
      return
    }
    if (step === 'confirm' && value !== firstEntry) {
      setStep('create')
      setError("Those didn't match. Start again.")
      return
    }
    setBusy(true)
    try {
      await (step === 'confirm' ? create(value) : unlock(value))
    } catch {
      setError("Can't reach the database. Check your connection and try again.")
      if (step === 'confirm') setStep('create')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <img src="/icon.svg" alt="" width="56" height="56" />
        <h1>{HEADINGS[step]}</h1>
        {step === 'create' && <p className="auth-intro">You'll use this on your laptop and your phone.</p>}

        {(step === 'create' || step === 'confirm' || step === 'unlock') && (
          // Keyed by step so the box is ready for typing again after "Enter it again".
          <input
            key={step}
            id="passcode"
            className="passcode-input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={LENGTH}
            aria-label={HEADINGS[step]}
            disabled={busy}
            value={code}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '').slice(0, LENGTH)
              setCode(value)
              if (value.length === LENGTH) submit(value)
            }}
          />
        )}

        {busy && <p className="auth-intro">Checking…</p>}
        {error && (
          <p className="form-error passcode-error" role="alert">
            {error}
          </p>
        )}

        {step === 'unavailable' && (
          <button type="button" className="btn btn-primary" onClick={check}>
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
