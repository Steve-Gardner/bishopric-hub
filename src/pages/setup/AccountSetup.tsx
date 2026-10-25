import { useEffect, useState } from 'react'
import { supabase } from '../../data/cloud'
import { deviceRecordCount, uploadDeviceData } from '../../data/upload'

// Who is signed in, a way to sign out, and a one-time way to move what this phone saved before the shared
// database existed into it.
export default function AccountSetup() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const onDevice = deviceRecordCount()

  useEffect(() => { supabase!.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')) }, [])

  const upload = async () => {
    if (!confirm(`Copy the ${onDevice} records saved on this phone into the shared database? Anything with the same id there is replaced.`)) return
    setBusy(true)
    try { setMessage(`Copied ${await uploadDeviceData()} records to the shared database.`) }
    catch (e) { setMessage(e instanceof Error ? e.message : 'The copy did not finish.') }
    setBusy(false)
  }

  return (
    <>
      <p>Signed in as <strong>{email || '…'}</strong>. Everyone who signs in sees the same data, and changes appear on other phones within a moment.</p>
      <div className="row actions">
        <button onClick={async () => { await supabase!.auth.signOut(); location.reload() }}>Sign out</button>
      </div>
      {onDevice > 0 && (
        <>
          <p className="muted small">This phone also has {onDevice} records saved from before the shared database. Copy them over once, from the phone that has the real data.</p>
          <button className="primary" disabled={busy} onClick={upload}>{busy ? 'Copying…' : 'Copy this phone\'s data to the shared database'}</button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </>
  )
}
