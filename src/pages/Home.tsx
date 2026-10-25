import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { eventStore } from '../data/store'
import { fmtTime } from '../data/format'
import { upcoming, type Occurrence } from '../data/recurrence'

export const SECTIONS = [
  { to: '/calendar', label: 'Calendar', blurb: 'Events, interviews, assignments' },
  { to: '/agenda', label: 'Agenda', blurb: 'Bishopric meeting, schedule, ward needs' },
  { to: '/sacrament', label: 'Sacrament', blurb: 'Speakers and prayers log' },
  { to: '/fsy', label: 'Youth', blurb: 'Weekly lesson and patriarchal blessings' },
  { to: '/schedule', label: 'Schedule', blurb: 'Interviews, conducting, gratitude, special dates' },
  { to: '/setup', label: 'Setup', blurb: 'Roles, youth roster, backup, and demo data' },
]

export default function Home() {
  const [next, setNext] = useState<Occurrence[]>([])

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    eventStore.list().then((all) => setNext(upcoming(all, today, 3)))
  }, [])

  return (
    <section>
      <h1>Welcome</h1>
      <p className="muted">
        {format(new Date(), 'EEEE, MMMM d')}
      </p>

      <div className="tiles">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to} className={`tile ${'wide' in s && s.wide ? 'tile-wide' : ''}`}>
            <strong>{s.label}</strong>
            <span className="muted">{s.blurb}</span>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2>Coming up</h2>
        <ul className="plain">
          {next.map(({ event, date }) => (
            <li key={event.id + date}>
              <span><strong>{format(parseISO(date), 'EEE, MMM d')}</strong> {event.title}</span>
              <span className="muted">{fmtTime(event.time)}</span>
            </li>
          ))}
          {next.length === 0 && <li className="muted">Nothing on the calendar yet.</li>}
        </ul>
      </div>

    </section>
  )
}
