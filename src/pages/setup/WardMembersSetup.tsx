import { useEffect, useMemo, useState } from 'react'
import { memberStore, sacramentStore } from '../../data/store'
import type { Member } from '../../data/types'

// The ward's adults. Sacrament prayers and adult speakers are chosen from this list, and "Not asked lately"
// on the Sacrament tab is built from it.
export default function WardMembersSetup() {
  const [members, setMembers] = useState<Member[]>([])
  const [names, setNames] = useState('')

  const reload = async () => setMembers(await memberStore.list())
  useEffect(() => { reload() }, [])
  const sorted = useMemo(() => [...members].sort((a, b) => a.name.localeCompare(b.name)), [members])

  const add = async () => {
    const existing = new Set(members.map((m) => m.name.toLowerCase()))
    const fresh = names.split(/[\n,]/).map((n) => n.trim()).filter((n) => n && !existing.has(n.toLowerCase()))
    await Promise.all(fresh.map((name) => memberStore.save({ id: crypto.randomUUID(), name })))
    setNames('')
    reload()
  }

  const remove = async (m: Member) => {
    if (!confirm(`Remove ${m.name} and the meeting items that name them?`)) return
    const items = (await sacramentStore.list()).filter((e) => e.memberId === m.id)
    await Promise.all(items.map((e) => sacramentStore.remove(e.id)))
    await memberStore.remove(m.id)
    reload()
  }

  return (
    <>
      <form onSubmit={(ev) => { ev.preventDefault(); add() }}>
        <label>Add names (one per line, or comma-separated)
          <textarea rows={4} value={names} onChange={(ev) => setNames(ev.target.value)} placeholder={'Jane Smith\nJohn Doe'} />
        </label>
        <button type="submit" className="primary" disabled={!names.trim()}>Add</button>
      </form>
      <p className="muted small">Names typed into a prayer or adult speaker are added here automatically.</p>
      <ul className="plain">
        {sorted.map((m) => (
          <li key={m.id}>{m.name}<button className="danger" aria-label={`Remove ${m.name}`} onClick={() => remove(m)}>✕</button></li>
        ))}
        {members.length === 0 && <li className="muted">No members yet.</li>}
      </ul>
    </>
  )
}
