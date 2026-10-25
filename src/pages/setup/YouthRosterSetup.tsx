import { useEffect, useState } from 'react'
import PencilIcon from '../../components/PencilIcon'
import { sacramentStore, youthStore } from '../../data/store'
import { YOUTH_GROUPS, type Youth, type YouthGroup } from '../../data/types'

// The one list of young men and young women. Patriarchal Blessings tracks each of them, and the youth
// speakers for sacrament meeting are chosen from it.
export default function YouthRosterSetup() {
  const [youth, setYouth] = useState<Youth[]>([])
  const [names, setNames] = useState('')
  const [group, setGroup] = useState<YouthGroup>('young-men')
  const [editing, setEditing] = useState<Youth | null>(null)
  const [error, setError] = useState('')

  const reload = async () => setYouth((await youthStore.list()).sort((a, b) => a.name.localeCompare(b.name)))
  useEffect(() => { reload() }, [])

  const add = async () => {
    const have = new Set(youth.map((y) => y.name.toLowerCase()))
    const fresh = names.split(/[\n,]/).map((n) => n.trim()).filter((n) => n && !have.has(n.toLowerCase()))
    await Promise.all(fresh.map((name) => youthStore.save({ id: crypto.randomUUID(), name, group, status: 'not-yet' })))
    setNames('')
    reload()
  }

  const save = async () => {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) { setError('Enter a name.'); return }
    await youthStore.save({ ...editing, name })
    setEditing(null)
    reload()
  }

  const remove = async () => {
    if (!editing || !confirm(`Remove ${editing.name} from the roster? Their blessing status and any youth speaker items go too.`)) return
    const items = (await sacramentStore.list()).filter((e) => e.youthId === editing.id)
    await Promise.all(items.map((e) => sacramentStore.remove(e.id)))
    await youthStore.remove(editing.id)
    setEditing(null)
    reload()
  }

  return (
    <>
      <p className="muted small">Patriarchal Blessings and the Youth Speaker choice in Sacrament both use this list.</p>
      <form onSubmit={(ev) => { ev.preventDefault(); add() }}>
        <label>Add names (one per line, or comma-separated)
          <textarea rows={3} value={names} onChange={(ev) => setNames(ev.target.value)} placeholder={'Jane Smith\nJohn Doe'} />
        </label>
        <label>They are
          <select value={group} onChange={(ev) => setGroup(ev.target.value as YouthGroup)}>
            {Object.entries(YOUTH_GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="submit" className="primary" disabled={!names.trim()}>Add</button>
      </form>

      <ul className="plain">
        {youth.map((y) => (
          <li key={y.id}>
            <span>{y.name} <span className="muted small">{YOUTH_GROUPS[y.group]}</span></span>
            <button className="icon-btn" aria-label={`Edit ${y.name}`} title="Edit" onClick={() => { setEditing(y); setError('') }}><PencilIcon /></button>
          </li>
        ))}
        {youth.length === 0 && <li className="muted">No youth yet.</li>}
      </ul>

      {editing && (
        <div className="modal" onClick={() => setEditing(null)}>
          <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); save() }}>
            <h2>Edit youth</h2>
            <label>Name
              <input autoFocus value={editing.name} onChange={(ev) => { setEditing({ ...editing, name: ev.target.value }); setError('') }} />
            </label>
            <label>Designation
              <select value={editing.group} onChange={(ev) => setEditing({ ...editing, group: ev.target.value as YouthGroup })}>
                {Object.entries(YOUTH_GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            {error && <p role="alert" className="form-error">{error}</p>}
            <div className="row actions">
              <button type="submit" className="primary">Save</button>
              <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="danger" onClick={remove}>Remove</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
