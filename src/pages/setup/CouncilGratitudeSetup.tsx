import { useEffect, useState } from 'react'
import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { staffSuggestions, useStaff } from '../../components/useStaff'
import { adjacentMeeting, nextMeeting } from '../../data/recurrence'
import { councilAssignmentStore, eventStore } from '../../data/store'
import type { CouncilAssignment } from '../../data/types'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

// Ward Council assignments: the gratitude and scripture and the roles and responsibilities are given by
// two different people. These fill in the Meeting Roles on the Ward Council agenda.
export default function CouncilGratitudeSetup() {
  const { names } = useStaff()
  const [rows, setRows] = useState<CouncilAssignment[]>([])
  const [date, setDate] = useState('')
  const [gratitude, setGratitude] = useState('')
  const [roles, setRoles] = useState('')

  const reload = async () => {
    const all = (await councilAssignmentStore.list()).sort((a, b) => a.date.localeCompare(b.date))
    const meetings = (await eventStore.list()).filter((e) => e.agenda === 'council')
    setRows(all)
    // Suggest the meeting after the last assignment, or the next meeting if there are none.
    const last = all.at(-1)
    const fallback = iso(addDays(startOfWeek(new Date()), new Date().getDay() === 0 ? 0 : 7))
    setDate(last ? (adjacentMeeting(meetings, last.date, 1) ?? iso(addDays(parseISO(last.date), 14))) : (nextMeeting(meetings, iso(new Date())) ?? fallback))
  }
  useEffect(() => { reload() }, [])

  const add = async () => {
    if (!date || (!gratitude.trim() && !roles.trim())) return
    const existing = rows.find((r) => r.date === date)
    await councilAssignmentStore.save({
      id: existing?.id ?? crypto.randomUUID(), date,
      gratitude: gratitude.trim() || existing?.gratitude, roles: roles.trim() || existing?.roles,
    })
    setGratitude('')
    setRoles('')
    reload()
  }
  const patch = async (r: CouncilAssignment, p: Partial<CouncilAssignment>) => {
    await councilAssignmentStore.save({ ...r, ...p })
    reload()
  }
  const today = iso(new Date())

  return (
    <>
      <p className="muted">
        Gratitude &amp; Scripture and Roles &amp; Responsibilities are separate assignments at the Ward Council. They fill in
        that meeting's Meeting Roles on the agenda, where you can still change any one meeting.
      </p>

      <ul className="plain">
        {rows.map((r) => (
          <li key={r.id} className={`assign council-assign ${r.date < today ? 'past' : ''}`}>
            <input type="date" defaultValue={r.date} key={r.id + r.date} aria-label="Date"
              onBlur={(ev) => ev.target.value && ev.target.value !== r.date && patch(r, { date: ev.target.value })} />
            <button className="danger" aria-label="Remove assignment" onClick={async () => { await councilAssignmentStore.remove(r.id); reload() }}>✕</button>
            <div className="assign-names">
              <label>Gratitude &amp; Scripture
                <input list="assign-names" defaultValue={r.gratitude ?? ''} key={r.id + 'g' + (r.gratitude ?? '')}
                  onBlur={(ev) => ev.target.value.trim() !== (r.gratitude ?? '') && patch(r, { gratitude: ev.target.value.trim() || undefined })} />
              </label>
              <label>Roles &amp; Responsibilities
                <input list="assign-names" defaultValue={r.roles ?? ''} key={r.id + 'r' + (r.roles ?? '')}
                  onBlur={(ev) => ev.target.value.trim() !== (r.roles ?? '') && patch(r, { roles: ev.target.value.trim() || undefined })} />
              </label>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="muted">No assignments yet.</li>}
      </ul>

      <form className="council-assign-add" onSubmit={(ev) => { ev.preventDefault(); add() }}>
        <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} aria-label="Date" />
        <div className="assign-names">
          <input list="assign-names" value={gratitude} onChange={(ev) => setGratitude(ev.target.value)} placeholder="Gratitude & Scripture" aria-label="Gratitude and Scripture" />
          <input list="assign-names" value={roles} onChange={(ev) => setRoles(ev.target.value)} placeholder="Roles & Responsibilities" aria-label="Roles and Responsibilities" />
        </div>
        <button type="submit" className="primary" disabled={!date || (!gratitude.trim() && !roles.trim())}>Add</button>
      </form>
      <datalist id="assign-names">{staffSuggestions(names).map((n) => <option key={n} value={n} />)}</datalist>
    </>
  )
}
