import { useEffect, useState } from 'react'
import App from './App'
import SignIn from './components/SignIn'
import { cloudEnabled, loadAll, supabase, watchChanges } from './data/cloud'
import { migrateIdentity } from './data/migrate'

type Phase = 'loading' | 'signin' | 'denied' | 'ready' | 'error'

// Gets the app ready: with the shared database, sign in, check the email is on the list, load the data and
// start watching for changes; then bring older records up to date. Without it, just the last step.
export default function Root() {
  const [phase, setPhase] = useState<Phase>('loading')

  const start = async () => {
    try {
      if (cloudEnabled) {
        const { data } = await supabase!.auth.getSession()
        if (!data.session) { setPhase('signin'); return }
        const { data: allowed } = await supabase!.rpc('is_allowed')
        if (!allowed) { setPhase('denied'); return }
        await loadAll()
      }
      await migrateIdentity().catch(() => undefined)
      setPhase('ready')
    } catch {
      setPhase('error')
    }
  }
  useEffect(() => { start() }, [])
  useEffect(() => (phase === 'ready' && cloudEnabled ? watchChanges() : undefined), [phase])

  if (phase === 'ready') return <App />
  if (phase === 'signin') return <SignIn onSignedIn={() => { setPhase('loading'); start() }} />
  if (phase === 'denied') {
    return (
      <main className="signin">
        <h1>5th Ward Bishopric Hub</h1>
        <p>This email is not on the list for the hub. Ask the bishop to add it.</p>
        <button onClick={async () => { await supabase!.auth.signOut(); setPhase('signin') }}>Use a different email</button>
      </main>
    )
  }
  if (phase === 'error') {
    return (
      <main className="signin">
        <h1>5th Ward Bishopric Hub</h1>
        <p>The hub could not reach its data. Check your connection and try again.</p>
        <button className="primary" onClick={() => { setPhase('loading'); start() }}>Try again</button>
      </main>
    )
  }
  return <main className="signin"><p className="muted">Loading…</p></main>
}
