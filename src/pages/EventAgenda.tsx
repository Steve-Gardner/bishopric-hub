import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ListEditor from '../components/ListEditor'
import { useStaff } from '../components/useStaff'
import { fmtRange } from '../data/format'
import { attendeeLabel } from '../data/people'
import { describeRecurrence } from '../data/recurrence'
import { eventStore } from '../data/store'
import type { CalendarEvent } from '../data/types'

export default function EventAgenda() {
  const { names } = useStaff()
  const { id } = useParams()
  const date = useSearchParams()[0].get('date')
  const [event, setEvent] = useState<CalendarEvent | null | undefined>(undefined)

  useEffect(() => {
    eventStore.list().then((all) => setEvent(all.find((e) => e.id === id) ?? null))
  }, [id])

  if (event === undefined) return null
  if (event === null) {
    return (
      <section>
        <p><Link to="/calendar">← Calendar</Link></p>
        <p className="muted">That event no longer exists.</p>
      </section>
    )
  }

  return (
    <section>
      <p><Link to={date ? `/calendar?date=${date}` : '/calendar'}>{date ? `← View ${format(parseISO(date), 'EEE, MMM d')} on the calendar` : '← Calendar'}</Link></p>
      <h1>{event.title}</h1>
      <p className="muted">
        {event.recurrence ? describeRecurrence(event) : format(parseISO(event.date), 'EEEE, MMM d, yyyy')}
        {event.time ? ` · ${fmtRange(event.time, event.endTime)}` : ''}
        {attendeeLabel(event, names) ? ` · ${attendeeLabel(event, names)}` : ''}
      </p>
      {event.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{event.notes}</p>}
      <ListEditor listKey={`event:${event.id}`} title="Agenda" placeholder="Add an agenda item" checkable />
      {event.recurrence && <p className="muted">Unfinished items carry over to the next meeting in this series.</p>}
    </section>
  )
}
