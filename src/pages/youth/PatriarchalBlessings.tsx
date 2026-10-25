import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import PencilIcon from '../../components/PencilIcon'
import { youthStore } from '../../data/store'
import {
  BLESSING_STATUS, YOUTH_GROUPS,
  type BlessingStatus, type Youth,
} from '../../data/types'

type Filter = 'all' | BlessingStatus

// Each young man or young woman, with where they are in getting a patriarchal blessing. Only the name,
// designation, status, and appointment are kept, never anything about the blessing itself. The list is
// read-only; the pencil on each card opens the form to change it.
export default function PatriarchalBlessings({ onChange }: { onChange?: () => void }) {
  const [youth, setYouth] = useState<Youth[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Youth | null>(null)

  const reload = async () =>
    setYouth((await youthStore.list()).sort((a, b) => a.name.localeCompare(b.name)))
  useEffect(() => { reload() }, [])

  const counts = useMemo(() => {
    const c: Record<BlessingStatus, number> = { 'not-yet': 0, scheduled: 0, received: 0 }
    youth.forEach((y) => c[y.status]++)
    return c
  }, [youth])

  const shown = youth.filter((y) => filter === 'all' || y.status === filter)

  const open = (y: Youth) => setEditing(y)
  const close = () => setEditing(null)

  const save = async () => {
    if (!editing) return
    const next = { ...editing }
    if (next.status !== 'scheduled') delete next.appointmentDate // a date only applies while scheduled
    await youthStore.save(next)
    close()
    await reload()
    onChange?.()
  }

  return (
    <>
      <p className="muted">Status and appointment only. Don't record anything about the blessing itself. The youth come from the Youth Roster in Setup.</p>

      <div className="tabs">
        <button className={filter === 'all' ? 'primary' : ''} onClick={() => setFilter('all')}>All ({youth.length})</button>
        {(Object.keys(BLESSING_STATUS) as BlessingStatus[]).map((s) => (
          <button key={s} className={filter === s ? 'primary' : ''} onClick={() => setFilter(s)}>
            {BLESSING_STATUS[s]} ({counts[s]})
          </button>
        ))}
      </div>

      <ul className="plain youth-list">
        {shown.map((y) => (
          <li key={y.id} className="youth-card">
            <div className="youth-top">
              <div>
                <strong className="youth-name">{y.name}</strong>
                <span className="muted youth-group">{YOUTH_GROUPS[y.group]}</span>
              </div>
              <button className="icon-btn" onClick={() => open(y)} aria-label={`Edit ${y.name}`} title="Edit">
                <PencilIcon />
              </button>
            </div>
            <div className="youth-meta">
              <span className={`status-pill s-${y.status}`}>{BLESSING_STATUS[y.status]}</span>
              {y.status === 'scheduled' && (
                y.appointmentDate
                  ? <span>Appointment: {format(parseISO(y.appointmentDate), 'EEE, MMM d, yyyy')}</span>
                  : <span className="muted">No appointment date yet</span>
              )}
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="muted">{youth.length ? 'No one with this status.' : 'No youth yet. Add them in the Youth Roster.'}</li>}
      </ul>

      <p className="muted small"><Link to="/setup?open=setup-youth-roster" className="linkish">Add or remove youth in Setup</Link></p>

      {editing && (
        <div className="modal" onClick={close}>
          <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); save() }}>
            <h2>{editing.name}</h2>
            <p className="muted small">{YOUTH_GROUPS[editing.group]}</p>
            <label>Status
              <select value={editing.status} onChange={(ev) => setEditing({ ...editing, status: ev.target.value as BlessingStatus })}>
                {Object.entries(BLESSING_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            {editing.status === 'scheduled' && (
              <label>Appointment date
                <input type="date" value={editing.appointmentDate ?? ''} onChange={(ev) => setEditing({ ...editing, appointmentDate: ev.target.value || undefined })} />
              </label>
            )}
            <div className="row actions">
              <button type="submit" className="primary">Save</button>
              <button type="button" onClick={close}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
