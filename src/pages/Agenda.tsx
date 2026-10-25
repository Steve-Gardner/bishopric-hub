import { useEffect, useState, type ReactNode } from 'react'
import { addDays, format, isValid, parseISO, startOfWeek } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { adjacentMeeting, nextMeeting } from '../data/recurrence'
import { eventStore } from '../data/store'
import type { CalendarEvent } from '../data/types'
import BishopricAgenda from './agenda/BishopricAgenda'
import CouncilAgenda from './agenda/CouncilAgenda'

type AgendaType = 'bishopric' | 'council'

// `short` is shown instead of `label` on narrow screens so the buttons and the date arrows fit on one row.
const TYPES: { key: AgendaType; label: string; short: ReactNode; title: string }[] = [
  { key: 'bishopric', label: 'Bishopric Meeting', short: 'Bishopric', title: 'Bishopric Meeting Agenda' },
  { key: 'council', label: 'Ward Council', short: <>Ward<br />Council</>, title: 'Ward Council Agenda' },
]

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
// The next Sunday on or after today, used when no meeting of this type is on the calendar.
const nextSunday = () => iso(addDays(startOfWeek(new Date()), new Date().getDay() === 0 ? 0 : 7))

// Chooses between the two agendas and works out which meeting is selected. The selection lives in the URL
// (?type=council&date=2026-10-25), so links from the calendar and the back button keep working.
export default function Agenda() {
  const [params, setParams] = useSearchParams()
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  useEffect(() => { eventStore.list().then(setEvents) }, [])

  const type: AgendaType = params.get('type') === 'council' ? 'council' : 'bishopric'
  if (events === null) return null

  // Meetings come from calendar events set to use this agenda; without any, fall back to weekly Sundays.
  const meetings = events.filter((e) => e.agenda === type)
  const today = iso(new Date())
  const linked = params.get('date')
  const date = linked && isValid(parseISO(linked)) ? linked : (nextMeeting(meetings, today) ?? nextSunday())
  const prevDate = adjacentMeeting(meetings, date, -1) ?? iso(addDays(parseISO(date), -7))
  const nextDate = adjacentMeeting(meetings, date, 1) ?? iso(addDays(parseISO(date), 7))

  const goTo = (d: string) => setParams(type === 'council' ? { type, date: d } : { date: d }, { replace: true })
  const choose = (t: AgendaType) => setParams(t === 'council' ? { type: t } : {}, { replace: true })
  const prevOf = (d: string) => adjacentMeeting(meetings, d, -1) ?? iso(addDays(parseISO(d), -7))
  const pretty = (d: string) => format(parseISO(d), 'MMM d')
  const chip = (d: string) => format(parseISO(d), parseISO(d).getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy')

  return (
    <section>
      <div className="agenda-bar">
        <div className="tabs">
          {TYPES.map((t) => (
            <button key={t.key} className={type === t.key ? 'primary' : ''} onClick={() => choose(t.key)}><span className="long">{t.label}</span><span className="short">{t.short}</span></button>
          ))}
          <button className="ghost-tab" disabled title="Coming soon" aria-label="Youth Council, coming soon">
            Youth Council<small>(Coming Soon)</small>
          </button>
        </div>
        <div className="date-nav-inline">
          <button onClick={() => goTo(prevDate)} aria-label={`Previous meeting, ${pretty(prevDate)}`} title={`Previous meeting, ${pretty(prevDate)}`}>‹</button>
          <label className="date-chip" title="Choose a meeting date">
            {chip(date)}
            <input type="date" value={date} aria-label={`Meeting date, ${chip(date)}. Change`} onChange={(ev) => ev.target.value && goTo(ev.target.value)} />
          </label>
          <button onClick={() => goTo(nextDate)} aria-label={`Next meeting, ${pretty(nextDate)}`} title={`Next meeting, ${pretty(nextDate)}`}>›</button>
        </div>
      </div>
      <h1 className="agenda-title">{TYPES.find((t) => t.key === type)?.title}</h1>
      {type === 'bishopric' ? <BishopricAgenda date={date} prevOf={prevOf} /> : <CouncilAgenda date={date} prevOf={prevOf} />}
    </section>
  )
}
