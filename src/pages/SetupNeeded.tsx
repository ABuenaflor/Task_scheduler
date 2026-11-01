export function SetupNeeded() {
  return (
    <div className="auth-page">
      <div className="card auth-card">
        <img src="/icon.svg" alt="" width="56" height="56" />
        <h1>Connect your database</h1>
        <p className="auth-intro">
          Copy <code>.env.example</code> to <code>.env</code>, add your Supabase project URL and key, then restart the
          app. The README has the full steps.
        </p>
      </div>
    </div>
  )
}
