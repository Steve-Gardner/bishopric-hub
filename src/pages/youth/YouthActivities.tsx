import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fmtRange } from '../../data/format'
import { eventStore } from '../../data/store'
import { describeGroups, type CalendarEvent } from '../../data/types'

const today = () => format(new Date(), 'yyyy-MM-dd')

function Rows({ items, past }: { items: CalendarEvent[]; past?: boolean }) {
  return (
    <ul className="plain">
      {items.map((a) => (
        <li key={a.id} style={past ? { opacity: 0.6 } : undefined}>
          <span style={{ flex: 1 }}>
            <strong>{a.title}</strong>
            <br />
            <span className="muted">
              {[format(parseISO(a.date), 'EEE, MMM d'), fmtRange(a.time, a.endTime), a.location].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className="muted" style={{ textAlign: 'right', maxWidth: '45%' }}>{describeGroups(a.youthGroups ?? [])}</span>
        </li>
      ))}
    </ul>
  )
}

// Read-only list of youth activities, upcoming first and then past; they are added and edited under Schedule.
export default function YouthActivities({ upcoming, past }: { upcoming: CalendarEvent[]; past: CalendarEvent[] }) {
  return (
    <div className="fold-pad">
      {upcoming.length === 0 && <p className="muted">No upcoming activities. Add them under Schedule.</p>}
      <Rows items={upcoming} />
      {past.length > 0 && (
        <>
          <h3 className="muted" style={{ margin: '12px 0 0' }}>Past</h3>
          <Rows items={past} past />
        </>
      )}
    </div>
  )
}

export function useYouthActivities(): { upcoming: CalendarEvent[]; past: CalendarEvent[] } {
  const [all, setAll] = useState<CalendarEvent[]>([])
  useEffect(() => {
    eventStore.list().then((events) => setAll(events.filter((e) => e.youthGroups?.length)))
  }, [])
  const now = today()
  return {
    upcoming: all.filter((a) => a.date >= now).sort((a, b) => a.date.localeCompare(b.date)),
    past: all.filter((a) => a.date < now).sort((a, b) => b.date.localeCompare(a.date)),
  }
}
