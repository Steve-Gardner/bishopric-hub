import { useEffect, useState } from 'react'
import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { staffSuggestions, useStaff } from '../../components/useStaff'
import { gratitudeStore } from '../../data/store'
import type { GratitudeAssignment } from '../../data/types'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

// Sunday assignments for the Bishopric Meeting, where one person gives both the gratitude statement and
// the roles and responsibilities.
export default function BishopricGratitudeSetup() {
  const { names } = useStaff()
  const [rows, setRows] = useState<GratitudeAssignment[]>([])
  const [date, setDate] = useState('')
  const [person, setPerson] = useState('')

  const reload = async () => {
    const all = (await gratitudeStore.list()).sort((a, b) => a.date.localeCompare(b.date))
    setRows(all)
    // Suggest the Sunday after the last assignment, or the coming Sunday if there are none.
    const last = all.at(-1)
    setDate(last ? iso(addDays(parseISO(last.date), 7)) : iso(addDays(startOfWeek(new Date()), new Date().getDay() === 0 ? 0 : 7)))
  }
  useEffect(() => { reload() }, [])

  const add = async () => {
    if (!date || !person.trim()) return
    await gratitudeStore.save({ id: crypto.randomUUID(), date, person: person.trim() })
    setPerson('')
    reload()
  }
  const patch = async (r: GratitudeAssignment, p: Partial<GratitudeAssignment>) => {
    await gratitudeStore.save({ ...r, ...p })
    reload()
  }
  const today = iso(new Date())

  return (
    <>
      <p className="muted">One person gives both the gratitude statement and the roles and responsibilities. The Bishopric Agenda shows the selected week and the next few.</p>

      <ul className="plain">
        {rows.map((r) => (
          <li key={r.id} className={`assign ${r.date < today ? 'past' : ''}`}>
            <input type="date" defaultValue={r.date} key={r.id + r.date} onBlur={(ev) => ev.target.value && ev.target.value !== r.date && patch(r, { date: ev.target.value })} aria-label="Date" />
            <input defaultValue={r.person} key={r.id + r.person} onBlur={(ev) => ev.target.value.trim() && ev.target.value.trim() !== r.person && patch(r, { person: ev.target.value.trim() })} aria-label="Assigned to" list="assign-names" />
            <button className="danger" aria-label="Remove assignment" onClick={async () => { await gratitudeStore.remove(r.id); reload() }}>✕</button>
          </li>
        ))}
        {rows.length === 0 && <li className="muted">No assignments yet.</li>}
      </ul>

      <form className="assign-add" onSubmit={(ev) => { ev.preventDefault(); add() }}>
        <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} aria-label="Date" />
        <input value={person} onChange={(ev) => setPerson(ev.target.value)} placeholder="Assigned to" aria-label="Assigned to" list="assign-names" />
        <button type="submit" className="primary" disabled={!date || !person.trim()}>Add</button>
      </form>
      <datalist id="assign-names">{staffSuggestions(names).map((n) => <option key={n} value={n} />)}</datalist>
    </>
  )
}
