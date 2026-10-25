import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PencilIcon from '../../components/PencilIcon'
import { useDismiss } from '../../components/useDismiss'
import { useScheduleData } from '../../components/useScheduleData'
import { readMyRole } from '../../components/useMyRole'
import { useStaff } from '../../components/useStaff'
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay,
  isSameMonth, isValid, parseISO, startOfMonth, startOfWeek,
} from 'date-fns'
import EventRow, { agendaLink, hasAgenda } from '../../components/EventRow'
import Fold from '../../components/Fold'
import { toIso } from '../../data/format'
import { memberLabel } from '../../data/memberFilter'
import { eventPeople } from '../../data/people'
import { ROLES, type RoleKey } from '../../data/roles'
import { eventsOnDay, upcoming } from '../../data/recurrence'
import { resolveDay } from '../../data/sundayPlan'
import { PRESIDENCY_COLUMNS, presidencyItems } from '../../data/todaySchedule'
import ScheduleGrid from '../agenda/ScheduleGrid'
import { appointmentStore } from '../../data/store'
import type { Appointment, CalendarEvent } from '../../data/types'
import MonthSchedule from '../../components/MonthSchedule'
import { useEvents } from './useEvents'

// Month grid: each day shows a colored dot per kind of event.
export default function Calendar() {
  const { events } = useEvents()
  const navigate = useNavigate()
  // Changing an event happens on the Schedule tab.
  const edit = (event: CalendarEvent, occurrence: string) =>
    navigate(event.youthGroups?.length
      ? `/schedule?open=setup-youth-activities&editActivity=${event.id}` // a youth activity has its own form
      : `/schedule?open=setup-events&edit=${event.id}&occ=${occurrence}`)
  // The agenda links here with ?date=yyyy-MM-dd to open the calendar on a particular day.
  const [params] = useSearchParams()
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)
  useDismiss(addRef, addOpen, () => setAddOpen(false)) // close on a tap elsewhere or Escape
  const linked = params.get('date')
  const linkedDate = linked && isValid(parseISO(linked)) ? parseISO(linked) : null
  const [month, setMonth] = useState(linkedDate ?? new Date())
  const [selected, setSelected] = useState(linkedDate ?? new Date())
  useEffect(() => {
    if (!linkedDate) return
    setSelected(linkedDate)
    setMonth(linkedDate)
  }, [linked]) // eslint-disable-line react-hooks/exhaustive-deps

  const { names } = useStaff()
  const sched = useScheduleData()

  // Show only one bishopric member's items for the selected day. It starts on Everyone, except for the bishop
  // (set under This Device in Setup), who starts on his own schedule. Changing it lasts until the page is left.
  const [member, setMember] = useState<'all' | RoleKey>(() => (readMyRole() === 'bishop' ? 'bishop' : 'all'))
  const chooseMember = setMember

  const [appts, setAppts] = useState<Appointment[]>([])
  const reloadAppts = useCallback(() => appointmentStore.list().then(setAppts), [])
  useEffect(() => { reloadAppts() }, [reloadAppts])

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) }),
    [month],
  )
  const selectedIso = toIso(selected)
  // A Sunday with a special designation (Family Sunday, Easter, General Conference...) says so after the date.
  const designation = (() => {
    if (selected.getDay() !== 0) return ''
    const day = resolveDay(selectedIso, sched.rows, sched.edits, sched.familyWeek, sched.special)
    return [...(day.family ? ['FAMILY SUNDAY'] : []), ...day.labels].join(' · ')
  })()
  const dayEvents = useMemo(() => eventsOnDay(events, selectedIso), [events, selectedIso])
  const shownEvents = member === 'all' ? dayEvents : dayEvents.filter((e) => eventPeople(e, names).includes(member))
  // The day is the bishop's and counselors' three-column schedule: events and appointments together. Events with none
  // of them attending are listed under it. Choosing one of the three narrows the schedule to that person's column.
  const allItems = useMemo(
    () => presidencyItems(dayEvents, appts.filter((a) => a.date === selectedIso), names),
    [dayEvents, appts, selectedIso, names],
  )
  const onlyColumn = PRESIDENCY_COLUMNS.indexOf(member as never) // -1 for Everyone and for anyone else
  const showGrid = member === 'all' || onlyColumn >= 0
  const gridCount = member === 'all' ? new Set(allItems.map((i) => i.id)).size : allItems.filter((i) => i.columns.includes(onlyColumn)).length
  const gridIds = new Set(allItems.map((i) => i.id))
  const otherEvents = dayEvents.filter((e) => !gridIds.has(e.id))
  const listEvents = member === 'all' ? otherEvents : onlyColumn >= 0 ? [] : shownEvents
  const totalCount = gridIds.size + otherEvents.length
  const hiddenCount = totalCount - ((showGrid ? gridCount : 0) + listEvents.length)
  const next2Weeks = useMemo(() => {
    const today = new Date()
    const end = toIso(addDays(today, 14))
    return upcoming(events, toIso(today), 40).filter((o) => o.date <= end)
  }, [events])

  return (
    <section>
      <div className="cal-head">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">‹</button>
        <h1>{format(month, 'MMMM yyyy')}</h1>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">›</button>
      </div>

      <div className="wgrid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="dow">{d}</div>)}
        {days.map((d) => {
          const evs = eventsOnDay(events, toIso(d))
          const types = [...new Set(evs.map((e) => e.type))].slice(0, 4)
          return (
            <button
              key={toIso(d)}
              className={[
                'wcell', 'narrow',
                isSameMonth(d, month) ? '' : 'out',
                isSameDay(d, new Date()) ? 'today' : '',
                isSameDay(d, selected) ? 'sel' : '',
              ].join(' ')}
              onClick={() => setSelected(d)}
            >
              <span className="num">{format(d, 'd')}</span>
              <span className="dots">{types.map((t) => <i key={t} className={`dotc t-${t}`} />)}</span>
            </button>
          )
        })}
      </div>

      <div className="agenda-head">
        <h2>{format(selected, 'EEEE, MMM d')}{designation && ` - ${designation}`}</h2>
        <div className="add-menu" ref={addRef}>
          <button className="primary" onClick={() => setAddOpen(!addOpen)} aria-haspopup="menu" aria-expanded={addOpen}>+ Add</button>
          {addOpen && (
            <ul className="menu" role="menu">
              <li role="none">
                <Link role="menuitem" className="menu-link" to={`/schedule?open=setup-appointments&appointments=${selectedIso}`} onClick={() => setAddOpen(false)}>
                  Interview or meeting
                </Link>
              </li>
              <li role="none">
                <Link role="menuitem" className="menu-link" to={`/schedule?open=setup-events&newEvent=${selectedIso}`} onClick={() => setAddOpen(false)}>
                  Other event
                </Link>
              </li>
              <li role="none">
                <Link role="menuitem" className="menu-link" to={`/schedule?open=setup-youth-activities&activity=${selectedIso}`} onClick={() => setAddOpen(false)}>
                  Youth activity
                </Link>
              </li>
            </ul>
          )}
        </div>
      </div>
      <div className="member-filter">
        <label>
          <select aria-label="Show items for" value={member} onChange={(ev) => chooseMember(ev.target.value as 'all' | RoleKey)}>
            <option value="all">Everyone</option>
            {ROLES.map((r) => <option key={r.key} value={r.key}>{memberLabel(r.key, names)}</option>)}
          </select>
        </label>
        <Link to={`/schedule?open=setup-appointments&appointments=${selectedIso}`} className="icon-btn" aria-label="Manage interviews and appointments in Schedule" title="Manage interviews and appointments">
          <PencilIcon />
        </Link>
        {member !== 'all' && hiddenCount > 0 && (
          <span className="muted small">
            {hiddenCount} other item{hiddenCount === 1 ? '' : 's'} hidden. <button className="linkish" onClick={() => chooseMember('all')}>Show everyone</button>
          </span>
        )}
      </div>
      {(showGrid ? gridCount : 0) + listEvents.length === 0 && (
        <p className="muted">
          {member !== 'all' && hiddenCount > 0 ? `Nothing for ${memberLabel(member, names)} on this day.` : 'Nothing scheduled.'}
        </p>
      )}
      {showGrid && gridCount > 0 && (
        <ScheduleGrid
          items={allItems}
          names={names}
          only={onlyColumn >= 0 ? onlyColumn : undefined}
          onOpen={(item) => { const e = dayEvents.find((x) => x.id === item.id); if (e) edit(e, selectedIso) }}
          extra={(item) => {
            const e = item.source === 'event' ? dayEvents.find((x) => x.id === item.id) : undefined
            return e && hasAgenda(e) && <Link to={agendaLink(e, selectedIso)} className="agenda-btn" onClick={(ev) => ev.stopPropagation()}>Agenda</Link>
          }}
        />
      )}
      {listEvents.length > 0 && (
        <ul className="evts">
          {listEvents.map((e) => <EventRow key={e.id} event={e} date={selectedIso} onEdit={edit} names={names} />)}
        </ul>
      )}

      <hr className="day-divider" />

      <Fold id="cal-next2weeks" title="Next 2 weeks" count={next2Weeks.length}>
        {next2Weeks.length === 0 && <p className="muted">Nothing coming up.</p>}
        <ul className="evts">
          {next2Weeks.map((o) => <EventRow key={o.event.id + o.date} event={o.event} date={o.date} showDate onEdit={edit} names={names} />)}
        </ul>
      </Fold>

      <Fold
        id="cal-schedule"
        title="This Month's Meeting Schedule"
        action={
          <Link to="/schedule?open=setup-monthly-schedule" className="icon-btn fold-edit" aria-label="Edit the meeting schedule in Schedule" title="Edit in Schedule">
            <PencilIcon />
          </Link>
        }
      >
        <MonthSchedule />
      </Fold>
    </section>
  )
}
