import { useCallback, useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import EventSheet from '../../components/EventSheet'
import Fold from '../../components/Fold'
import { fmtRange, nextSundayIso } from '../../data/format'
import { useStaff } from '../../components/useStaff'
import { attendeeLabel } from '../../data/people'
import { describeRecurrence } from '../../data/recurrence'
import { eventStore } from '../../data/store'
import { EVENT_TYPES, type CalendarEvent } from '../../data/types'

interface Props {
  editId?: string // open this event for changing (from a link on the Calendar)
  occurrence?: string // the day that was tapped, so one day of a repeating event can be deleted
  newDate?: string // start a new event on this day
}

interface Editing { event: CalendarEvent; exists: boolean; occurrence: string | null }

// Every calendar event, to change or add to. The Calendar links here instead of editing in place.
export default function EventsSetup({ editId, occurrence, newDate }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const { names } = useStaff()
  const [editing, setEditing] = useState<Editing | null>(null)
  const opened = useRef('') // the link that has already opened a sheet, so closing it doesn't open it again

  const reload = useCallback(() => eventStore.list().then(setEvents), [])
  useEffect(() => { reload() }, [reload])

  // Open what the link asked for, once the events are loaded.
  useEffect(() => {
    const link = `${editId ?? ''}|${occurrence ?? ''}|${newDate ?? ''}`
    if (opened.current === link || link === '||') return
    const found = editId ? events.find((e) => e.id === editId) : undefined
    if (found) setEditing({ event: found, exists: true, occurrence: occurrence ?? found.date })
    else if (newDate && !editId) setEditing({ event: blank(newDate), exists: false, occurrence: null })
    else return // the events are still loading
    opened.current = link
  }, [editId, occurrence, newDate, events])

  // Repeating events go in one group. The rest are grouped by the month and year they are on: this month and
  // later first (soonest first), then earlier months, most recent first.
  const shown = events.filter((e) => e.date && !e.youthGroups?.length)
  const repeating = shown.filter((e) => e.recurrence).sort((a, b) => a.title.localeCompare(b.title))
  const byMonth = new Map<string, CalendarEvent[]>()
  for (const e of shown.filter((x) => !x.recurrence)) byMonth.set(e.date.slice(0, 7), [...(byMonth.get(e.date.slice(0, 7)) ?? []), e])
  const thisMonth = format(new Date(), 'yyyy-MM')
  const months = [...byMonth.keys()].sort()
  const monthOrder = [...months.filter((m) => m >= thisMonth), ...months.filter((m) => m < thisMonth).reverse()]
  const row = (e: CalendarEvent) => (
    <li key={e.id} className="clickable" onClick={() => setEditing({ event: e, exists: true, occurrence: e.date })}>
      <span>
        <strong>{e.title}</strong>
        <span className="muted small"> {EVENT_TYPES[e.type]}{attendeeLabel(e, names) ? ` · ${attendeeLabel(e, names)}` : ''}</span>
        <br />
        <span className="muted small">
          {e.recurrence ? describeRecurrence(e) : format(parseISO(e.date), 'EEE, MMM d, yyyy')}
          {fmtRange(e.time, e.endTime) ? ` · ${fmtRange(e.time, e.endTime)}` : ''}
        </span>
      </span>
    </li>
  )

  return (
    <>
      <div className="row actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="muted" style={{ margin: 0 }}>Tap an event to change it. New meetings are made in the wizard under Interviews &amp; Appointments.</p>
        <button className="primary" onClick={() => setEditing({ event: blank(nextSundayIso()), exists: false, occurrence: null })}>+ Event</button>
      </div>
      {shown.length === 0 && <p className="muted">No events yet.</p>}
      {repeating.length > 0 && (
        <Fold id="events-repeating" title="Repeating events" count={repeating.length}>
          <ul className="plain">{repeating.map(row)}</ul>
        </Fold>
      )}
      {monthOrder.map((m) => (
        <Fold key={m} id={`events-${m}`} title={format(parseISO(`${m}-01`), 'MMMM yyyy')} count={byMonth.get(m)!.length}>
          <ul className="plain">
            {byMonth.get(m)!.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')).map(row)}
          </ul>
        </Fold>
      ))}
      {editing && (
        <EventSheet key={editing.event.id + (editing.occurrence ?? '')} {...editing} onClose={() => setEditing(null)} onChanged={reload} />
      )}
    </>
  )
}

const blank = (date: string): CalendarEvent => ({ id: crypto.randomUUID(), title: '', type: 'meeting', date })
