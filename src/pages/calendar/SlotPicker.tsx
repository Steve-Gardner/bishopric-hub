import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
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
// with either counselor, each time says who it is with.
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

  return (
    <div className="slot-picker">
      {days.length === 0 && <p className="muted">No open times in the next {weeks} Sundays.</p>}
      {days.map((date) => {
        const list = slots.filter((s) => s.date === date)
        const open = all.has(date)
        return (
          <div key={date} className="slot-day">
            <h3>{format(parseISO(date), 'EEEE, MMM d')}</h3>
            <div className="choice-grid">
              {(open ? list : list.slice(0, SHOWN_PER_DAY)).map((s) => (
                <button key={`${s.start}-${s.role}`} onClick={() => onPick(s)}>
                  {fmtTime(s.start)}{roles.length > 1 ? ` · ${label(s.role)}` : ''}
                </button>
              ))}
            </div>
            {!open && list.length > SHOWN_PER_DAY && (
              <button className="linkish small" onClick={() => setAll(new Set([...all, date]))}>Show all {list.length} times</button>
            )}
          </div>
        )
      })}
      {weeks < MAX_WEEKS && <button onClick={() => setWeeks(weeks + SUNDAYS_AT_FIRST)}>Show more Sundays</button>}
    </div>
  )
}
