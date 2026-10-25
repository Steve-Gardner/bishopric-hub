import { useState } from 'react'
import { supabase } from '../data/cloud'

// Sign in with an email and a one-time code sent to it. There is no password to remember.
export default function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setBusy(true); setError('')
    const { error: e } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (e) setError(e.message)
    else setSent(true)
  }
  const verify = async () => {
    setBusy(true); setError('')
    const { error: e } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (e) setError('That code did not work. Check it and try again, or ask for a new one.')
    else onSignedIn()
  }

  return (
    <main className="signin">
      <h1>5th Ward Bishopric Hub</h1>
      {!sent ? (
        <form onSubmit={(ev) => { ev.preventDefault(); if (email.trim()) send() }}>
          <p className="muted">Enter your email and we will send you a code to sign in.</p>
          <label>Email
            <input type="email" autoFocus autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
          </label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button type="submit" className="primary" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send me a code'}</button>
        </form>
      ) : (
        <form onSubmit={(ev) => { ev.preventDefault(); if (code.trim()) verify() }}>
          <p className="muted">We sent a code to {email.trim()}. It can take a minute.</p>
          <label>Code
            <input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(ev) => setCode(ev.target.value)} />
          </label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <div className="row actions">
            <button type="submit" className="primary" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Sign in'}</button>
            <button type="button" onClick={() => { setSent(false); setCode(''); setError('') }}>Use a different email</button>
          </div>
        </form>
      )}
    </main>
  )
}
