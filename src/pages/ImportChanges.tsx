import { useState } from 'react'
import { Link } from 'react-router-dom'
import { STORES } from '../data/store'

// A one-off way to load a batch of changes (such as a week's agenda) while signed in, by pasting what was
// prepared. Nothing about any person is in this file; the pasted text carries it. Reachable at #/import.
type Op =
  | { op: 'removeWhere'; store: string; field: string; in: string[] }
  | { op: 'merge'; store: string; id: string; set: Record<string, unknown> }
  | { op: 'put'; store: string; data: { id: string } & Record<string, unknown> }

interface Batch { label?: string; ops: Op[] }

function parse(text: string): { batch?: Batch; error?: string } {
  try {
    const batch = JSON.parse(text) as Batch
    if (!Array.isArray(batch.ops)) return { error: 'This is not a prepared batch of changes.' }
    for (const o of batch.ops) {
      if (!(o.store in STORES)) return { error: `Unknown list "${o.store}".` }
      if (o.op === 'put' && typeof o.data?.id !== 'string') return { error: 'A record in the batch has no id.' }
    }
    return { batch }
  } catch {
    return { error: 'That text is not complete. Copy the whole block again and paste it here.' }
  }
}

export default function ImportChanges() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const { batch, error } = text.trim() ? parse(text) : {}

  const counts = batch && {
    put: batch.ops.filter((o) => o.op === 'put').length,
    remove: batch.ops.filter((o) => o.op === 'removeWhere').length,
    merge: batch.ops.filter((o) => o.op === 'merge').length,
  }

  const apply = async () => {
    if (!batch) return
    setBusy(true)
    let removed = 0, saved = 0, changed = 0
    try {
      // Removals first, then changes to existing records, then the new records.
      for (const o of batch.ops) {
        if (o.op !== 'removeWhere') continue
        const store = STORES[o.store]
        const doomed = (await store.list()).filter((r) => o.in.includes(String((r as Record<string, unknown>)[o.field])))
        await Promise.all(doomed.map((r) => store.remove(r.id)))
        removed += doomed.length
      }
      for (const o of batch.ops) {
        if (o.op !== 'merge') continue
        const store = STORES[o.store]
        const found = (await store.list()).find((r) => r.id === o.id)
        if (found) { await store.save({ ...found, ...o.set }); changed++ }
      }
      for (const o of batch.ops) {
        if (o.op !== 'put') continue
        await STORES[o.store].save(o.data)
        saved++
      }
      setStatus(`Done. Removed ${removed}, changed ${changed}, saved ${saved}.`)
      setText('')
    } catch (e) {
      setStatus(`Stopped part way: ${e instanceof Error ? e.message : 'something went wrong'}. Nothing more was changed; you can paste it again to finish.`)
    }
    setBusy(false)
  }

  return (
    <section>
      <h1>Load prepared changes</h1>
      <p className="muted">Paste the block of text you were given, check the counts, then load it. It changes the shared data everyone sees.</p>
      <label htmlFor="import-text">Prepared changes
        <textarea id="import-text" rows={8} value={text} onChange={(ev) => { setText(ev.target.value); setStatus('') }} placeholder="Paste here" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </label>
      {error && <p role="alert" className="form-error">{error}</p>}
      {batch && counts && (
        <div className="card">
          <strong>{batch.label ?? 'Prepared changes'}</strong>
          <p className="muted">It will remove {counts.remove} group{counts.remove === 1 ? '' : 's'} of old records, change {counts.merge}, and save {counts.put}.</p>
          <div className="row actions">
            <button className="primary" disabled={busy} onClick={apply}>{busy ? 'Loading…' : 'Load into the hub'}</button>
            <button disabled={busy} onClick={() => setText('')}>Clear</button>
          </div>
        </div>
      )}
      {status && <p role="status">{status} <Link to="/agenda">Open the agenda</Link></p>}
    </section>
  )
}
