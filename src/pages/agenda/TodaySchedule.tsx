import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PencilIcon from '../../components/PencilIcon'
import { useStaff } from '../../components/useStaff'
import { eventsOnDay } from '../../data/recurrence'
import { appointmentStore, eventStore } from '../../data/store'
import { presidencyItems } from '../../data/todaySchedule'
import ScheduleGrid from './ScheduleGrid'
import type { Appointment, CalendarEvent } from '../../data/types'

interface Props {
  date: string
}

// What the bishop and his counselors are doing on a date, read from the Calendar and the appointments: one
// column each, and a meeting they all attend crosses all three.
export default function TodaySchedule({ date }: Props) {
  const { names } = useStaff()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  useEffect(() => {
    eventStore.list().then(setEvents)
    appointmentStore.list().then(setAppointments)
  }, [date])

  const items = useMemo(
    () => presidencyItems(eventsOnDay(events, date), appointments.filter((a) => a.date === date), names),
    [events, appointments, date, names],
  )

  return (
    <div className="card">
      <div className="gratitude-title">
        <h2>Bishopric Schedule</h2>
        <Link to="/schedule?open=setup-monthly-schedule" className="icon-btn" aria-label="Edit the schedule in Schedule" title="Edit in Schedule">
          <PencilIcon />
        </Link>
      </div>
      <div>
        <ScheduleGrid items={items} names={names} />
        {items.length === 0 && <p className="muted">Nothing scheduled for the bishopric on this day.</p>}
      </div>
    </div>
  )
}
