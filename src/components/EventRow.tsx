import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { fmtRange } from '../data/format'
import { attendeeLabel } from '../data/people'
import { EVENT_TYPES, describeGroups, type CalendarEvent } from '../data/types'

interface Props {
  event: CalendarEvent
  date: string
  showDate?: boolean
  onEdit: (event: CalendarEvent, date: string) => void
  names?: Record<string, string> // who holds each role, for the attendees' names
}

// An Agenda button only shows for an event that has an agenda: the Bishopric or Ward Council one, or a checklist
// chosen for it. Youth activities never have one.
export const hasAgenda = (event: CalendarEvent): boolean => !!event.agenda && !event.youthGroups?.length

export function agendaLink(event: CalendarEvent, date: string): string {
  if (event.agenda === 'bishopric') return `/agenda?date=${date}`
  if (event.agenda === 'council') return `/agenda?type=council&date=${date}`
  return `/event/${event.id}/agenda?date=${date}`
}

// One event, with a button that jumps to that meeting's agenda.
export default function EventRow({ event, date, showDate, onEdit, names = {} }: Props) {
  return (
    <li className={`evt t-${event.type}`} onClick={() => onEdit(event, date)}>
      <div className="evt-main">
        <strong>{event.title}{attendeeLabel(event, names) ? ` - ${attendeeLabel(event, names)}` : ''}</strong>
        <span className="muted">
          {showDate && `${format(parseISO(date), 'EEE, MMM d')} · `}
          {fmtRange(event.time, event.endTime) || 'All day'} · {EVENT_TYPES[event.type]}
          {event.youthGroups?.length ? ` · ${describeGroups(event.youthGroups)}` : ''}
          {event.location ? ` · ${event.location}` : ''}
          {event.movedFrom ? ` · moved from ${format(parseISO(event.movedFrom), 'MMM d')}` : ''}
        </span>
      </div>
      {hasAgenda(event) && (
        <Link to={agendaLink(event, date)} className="agenda-btn" onClick={(ev) => ev.stopPropagation()}>Agenda</Link>
      )}
    </li>
  )
}
