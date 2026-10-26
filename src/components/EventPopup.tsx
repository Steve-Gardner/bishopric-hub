import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { removeEventSeries, skipOccurrence } from '../data/eventActions'
import { fmtRange } from '../data/format'
import { attendeeLabel } from '../data/people'
import { describeRecurrence } from '../data/recurrence'
import { EVENT_TYPES, type CalendarEvent } from '../data/types'
import EventSheet from './EventSheet'
import { useStaff } from './useStaff'

interface Props {
  event: CalendarEvent
  date: string // the day that was tapped
  onClose: () => void
  onChanged: () => void
}

// What was tapped on the schedule: its details, a way to change it, and a way to delete it. Deleting asks
// first, and for a repeating event says whether it is this day only or every one.
export default function EventPopup({ event, date, onClose, onChanged }: Props) {
  const { names } = useStaff()
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const done = () => { onClose(); onChanged() }

  if (editing) return <EventSheet event={event} exists occurrence={date} onClose={onClose} onChanged={onChanged} />

  const who = attendeeLabel(event, names)
  const when = fmtRange(event.time, event.endTime)
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet popup" role="dialog" aria-modal="true" aria-label={event.title} onClick={(ev) => ev.stopPropagation()}>
        <h2>{event.title}</h2>
        <p className="muted">
          {EVENT_TYPES[event.type]} · {format(parseISO(date), 'EEEE, MMM d')}{when ? ` · ${when}` : ''}
          {event.recurrence ? ` · ${describeRecurrence(event)}` : ''}
        </p>
        {who && <p>With {who}</p>}
        {event.location && <p>{event.location}</p>}
        {event.notes && <p>{event.notes}</p>}

        {!confirming ? (
          <div className="row actions">
            <button className="primary" onClick={() => setEditing(true)}>Edit details</button>
            <button className="danger" onClick={() => setConfirming(true)}>Delete…</button>
            <button onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <p role="alert" className="form-error">
              {event.recurrence
                ? `Delete "${event.title}"? Choose whether it is only ${format(parseISO(date), 'MMM d')} or every time. This cannot be undone.`
                : `Delete "${event.title}" on ${format(parseISO(date), 'MMM d')}? This cannot be undone.`}
            </p>
            <div className="row actions">
              {event.recurrence && (
                <button className="danger" onClick={async () => { await skipOccurrence(event, date); done() }}>Only {format(parseISO(date), 'MMM d')}</button>
              )}
              <button className="danger" onClick={async () => { await removeEventSeries(event.id); done() }}>{event.recurrence ? 'Every time' : 'Yes, delete'}</button>
              <button onClick={() => setConfirming(false)}>Keep it</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
