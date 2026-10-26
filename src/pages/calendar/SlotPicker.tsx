import { useEffect, useMemo, useState } from 'react'
import { addDays, format, getDay, parseISO } from 'date-fns'
import { useScheduleData } from '../../components/useScheduleData'
import { useStaff } from '../../components/useStaff'
import { fmtTime } from '../../data/format'
import { openSlots, type Slot } from '../../data/openSlots'
import { ROLES, type RoleKey } from '../../data/roles'
import { appointmentStore, eventStore } from '../../data/store'
import type { Appointment, CalendarEvent } from '../../data/types'

const SUNDAYS_AT_FIRST = 4
const SHOWN_PER_DAY = 8

interface Props {
  minutes: number
  roles: RoleKey[] // who it could be with: the bishop, or either counselor
  ignoreId?: string // when moving an interview, its own old time is not in the way
  onPick: (slot: Slot) => void
}

// The open interview times on the next few Sundays, grouped by day. One tap picks a time. When it could be
// with either counselor, each counselor gets a column. A date and time can also be typed, for a time that
// is not one of the open ones; it is checked for double booking when it is saved.
export default function SlotPicker({ minutes, roles, ignoreId, onPick }: Props) {
  const { names } = useStaff()
  const sched = useScheduleData()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [appts, setAppts] = useState<Appointment[]>([])
  const [weeks, setWeeks] = useState(SUNDAYS_AT_FIRST)
  const [all, setAll] = useState<Set<string>>(new Set()) // days showing every time, not just the first few
  useEffect(() => { eventStore.list().then(setEvents); appointmentStore.list().then(setAppts) }, [])

  const slots = useMemo(() => openSlots({
    from: format(new Date(), 'yyyy-MM-dd'), weeks, roles, minutes, rows: sched.rows, edits: sched.edits, familyWeek: sched.familyWeek,
    special: sched.special, events, appts, names, ignoreId,
  }), [weeks, roles, minutes, sched.rows, sched.edits, sched.familyWeek, sched.special, events, appts, names, ignoreId])

  const label = (role: RoleKey) => names[role]?.trim() || ROLES.find((r) => r.key === role)?.label || role
  const days = [...new Set(slots.map((s) => s.date))]
  const MAX_WEEKS = 26
  const [other, setOther] = useState(() => {
    let d = addDays(new Date(), 1)
    while (getDay(d) !== 0) d = addDays(d, 1)
    return { date: format(d, 'yyyy-MM-dd'), time: '11:00', role: roles[0] }
  })

  return (
    <div className="slot-picker">
      {days.length === 0 && <p className="muted">No open times in the next {weeks} Sundays.</p>}
      {days.map((date) => {
        const list = slots.filter((s) => s.date === date)
        const open = all.has(date)
        return (
          <div key={date} className="slot-day">
            <h3>{format(parseISO(date), 'EEEE, MMM d')}</h3>
            {roles.length > 1 ? (
              <div className="slot-cols">
                {roles.map((role) => (
                  <div key={role}>
                    <h4>{label(role)}</h4>
                    <div className="slot-col">
                      {list.filter((x) => x.role === role).slice(0, open ? undefined : SHOWN_PER_DAY).map((x) => (
                        <button key={x.start} onClick={() => onPick(x)}>{fmtTime(x.start)}</button>
                      ))}
                      {!list.some((x) => x.role === role) && <span className="muted small">No open times</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="choice-grid">
                {(open ? list : list.slice(0, SHOWN_PER_DAY)).map((x) => (
                  <button key={`${x.start}-${x.role}`} onClick={() => onPick(x)}>{fmtTime(x.start)}</button>
                ))}
              </div>
            )}
            {!open && (roles.length > 1 ? roles.some((r) => list.filter((x) => x.role === r).length > SHOWN_PER_DAY) : list.length > SHOWN_PER_DAY) && (
              <button className="linkish small" onClick={() => setAll(new Set([...all, date]))}>Show all times</button>
            )}
          </div>
        )
      })}
      {weeks < MAX_WEEKS && <button onClick={() => setWeeks(weeks + SUNDAYS_AT_FIRST)}>Show more Sundays</button>}

      <details className="slot-override">
        <summary>Choose a different date or time</summary>
        <label>Day<input type="date" value={other.date} onChange={(ev) => ev.target.value && setOther({ ...other, date: ev.target.value })} /></label>
        <label>Start time<input type="time" value={other.time} onChange={(ev) => ev.target.value && setOther({ ...other, time: ev.target.value })} /></label>
        {roles.length > 1 && (
          <label>With
            <select value={other.role} onChange={(ev) => setOther({ ...other, role: ev.target.value as RoleKey })}>
              {roles.map((r) => <option key={r} value={r}>{label(r)}</option>)}
            </select>
          </label>
        )}
        <p className="muted small">Any day and time. If the person is already booked then, it will say so.</p>
        <button className="primary" onClick={() => onPick({ date: other.date, start: other.time, role: other.role })}>Book {fmtTime(other.time)} on {format(parseISO(other.date), 'MMM d')}</button>
      </details>
    </div>
  )
}
