import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useBlocker } from '../../components/useBlocker'
import { useStaff } from '../../components/useStaff'
import { APPOINTMENT_MINUTES, appointmentConflicts, eventConflicts } from '../../data/conflicts'
import { fmtRange, fmtTime } from '../../data/format'
import type { Slot } from '../../data/openSlots'
import { eventsOnDay } from '../../data/recurrence'
import { ROLES } from '../../data/roles'
import { attendeeLabel, leaderLabel as apptLeader } from '../../data/people'
import { appointmentStore, eventStore } from '../../data/store'
import { PRESIDENCY_COLUMNS, presidencyItems, splitColumns } from '../../data/todaySchedule'
import SlotPicker from './SlotPicker'
import type { Appointment, CalendarEvent } from '../../data/types'

const PX = 3.4 // pixels per minute
const GUTTER = 44 // width of the time labels
const DEFAULT_MINUTES = APPOINTMENT_MINUTES

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

interface Props {
  date: string
  appts: Appointment[]
  reload: () => void
  version: number // changes when a meeting is made elsewhere, to load the events again
}

// The day as three columns (Bishop, 1st Counselor, 2nd Counselor) down a time line. Tap an interview to move
// it to another open time or take it off the schedule.
export default function InterviewBoard({ date, appts, reload, version }: Props) {
  const { names } = useStaff()
  const { block, dialog } = useBlocker()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [picked, setPicked] = useState<string | null>(null) // the interview whose sheet is open
  const [moving, setMoving] = useState(false)

  const loadEvents = () => eventStore.list().then(setEvents)
  useEffect(() => { loadEvents() }, [date, version])

  const items = useMemo(
    () => presidencyItems(eventsOnDay(events, date), appts.filter((a) => a.date === date), names),
    [events, appts, date, names],
  )
  // The time line starts at the first thing of the day (or 10 AM) and runs an hour past the last, at least 4 hours.
  const times = items.filter((i) => i.start).flatMap((i) => [toMin(i.start!), i.end ? toMin(i.end) : toMin(i.start!) + 60])
  const START = Math.max(6 * 60, Math.floor(Math.min(...times, 10 * 60) / 60) * 60)
  const END = Math.min(21 * 60, Math.max(Math.ceil(Math.max(...times, 0) / 60) * 60 + 60, START + 240))
  const leaderLabel = (col: number) => {
    const role = ROLES.find((r) => r.key === PRESIDENCY_COLUMNS[col])!
    return names[role.key]?.trim() || role.label
  }

  // Move an interview to an open time picked in the sheet.
  const moveTo = async (appt: Appointment, slot: Slot) => {
    const moved: Appointment = { ...appt, date: slot.date, time: slot.start, leaderRole: slot.role, leader: leaderLabel(PRESIDENCY_COLUMNS.indexOf(slot.role)) }
    const clashes = appointmentConflicts(moved, events, await appointmentStore.list(), names)
    if (clashes.length) { block(clashes.map((c) => c.message)); return }
    await appointmentStore.save(moved)
    setPicked(null)
    setMoving(false)
    reload()
  }
  const remove = async (key: string) => {
    await appointmentStore.remove(key.slice(2))
    setPicked(null)
    reload()
  }

  // What a block says and how long it is, for interviews (a:) and meetings (e:) alike.
  const info = (key: string): { name: string; minutes: number; time?: string; detail: string; span: number } | undefined => {
    if (key.startsWith('a:')) {
      const a = appts.find((x) => x.id === key.slice(2))
      return a && { name: a.name, minutes: a.minutes ?? DEFAULT_MINUTES, time: a.time || undefined, detail: a.leaderRole || a.leader ? `with ${apptLeader(a, names)}` : 'not placed', span: 1 }
    }
    const e = events.find((x) => x.id === key.slice(2))
    return e && {
      name: e.title, time: e.time, span: 3,
      minutes: e.minutes ?? (e.time && e.endTime ? toMin(e.endTime) - toMin(e.time) : 60),
      detail: attendeeLabel(e, names) ? `attended by ${attendeeLabel(e, names)}` : 'not placed',
    }
  }

  const hours = Array.from({ length: (END - START) / 60 + 1 }, (_, i) => START + i * 60)
  const spanStyle = (col: number, span: number) => ({
    left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${col} / 3 + 2px)`,
    width: `calc((100% - ${GUTTER}px) * ${span} / 3 - 4px)`,
  })

  // A block on the time line. An interview can be tapped to move or remove it.
  const chip = (key: string, extra?: string) => {
    const i = info(key)
    if (!i) return null
    const tappable = key.startsWith('a:')
    const text = <span><strong>{i.name}</strong> <span className="small">{i.minutes} min{i.time ? ` · ${fmtTime(i.time)}` : ''}</span></span>
    const label = `${i.name}, ${i.minutes} minutes${i.time ? `, ${fmtTime(i.time)}` : ''}, ${i.detail}`
    return tappable ? (
      <button key={key} className={`board-meeting ${extra ?? ''}`} aria-label={`${label}. Tap to move or remove`} onClick={() => { setMoving(false); setPicked(key) }}>{text}</button>
    ) : (
      <div key={key} className={`board-meeting ${extra ?? ''}`} role="img" aria-label={label}>{text}</div>
    )
  }

  const sheetAppt = picked ? appts.find((a) => `a:${a.id}` === picked) : undefined
  const sheetRoles = sheetAppt?.leaderRole === 'bishop' ? ['bishop' as const] : PRESIDENCY_COLUMNS.filter((r) => r !== 'bishop')

  return (
    <>
      <div className="board-heads" style={{ paddingLeft: GUTTER }}>
        {PRESIDENCY_COLUMNS.map((role, i) => (
          <div key={role} className="today-head">
            <strong>{ROLES.find((r) => r.key === role)?.label}</strong>
            {names[role]?.trim() && <span className="muted small">{names[role]}</span>}
            <span className="sr-only">{leaderLabel(i)}</span>
          </div>
        ))}
      </div>

      <div className="board" style={{ height: (END - START) * PX }}>
        {[0, 1, 2].map((c) => (
          <div key={`lane-${c}`} className={`lane lane-${c}`} style={{ ...spanStyle(c, 1), top: 0, bottom: 0 }} aria-hidden="true" />
        ))}
        {hours.map((m) => (
          <div key={m} className="board-hour" style={{ top: (m - START) * PX }}>
            <span>{format(new Date(2000, 0, 1, m / 60), 'h a')}</span>
          </div>
        ))}
        {items.flatMap((item) => (item.start ? splitColumns(item).map((p) => ({ ...p, item })) : [])).map((p) => {
          const start = toMin(p.item.start!)
          const end = p.item.end ? Math.max(toMin(p.item.end), start + 5) : start + 60
          const key = `${p.item.source === 'appointment' ? 'a' : 'e'}:${p.item.id}`
          const ev = p.item.source === 'event' ? events.find((x) => x.id === p.item.id) : undefined
          const style = { ...spanStyle(p.column, p.span), top: (start - START) * PX, height: Math.max((end - start) * PX, 20) }
          if (p.item.source === 'event' && ev?.type !== 'meeting') {
            return (
              <div key={`${key}:${p.column}`} className="board-event" style={style}>
                <span className="today-time">{fmtRange(p.item.start, p.item.end)}</span> <strong>{p.item.title}</strong>
              </div>
            )
          }
          return (
            <div key={`${key}:${p.column}`} className="board-slot" style={style}>
              {chip(key, p.item.source === 'event' ? 'placed meeting' : 'placed')}
            </div>
          )
        })}
      </div>
      <p className="muted small">{format(parseISO(date), 'EEEE, MMM d')}. Other things on the bishopric's calendar show in gray. Tap an interview to move it or take it off.</p>

      {sheetAppt && (
        <div className="modal" onClick={() => { setPicked(null); setMoving(false) }}>
          <div className="sheet popup" role="dialog" aria-modal="true" aria-label={sheetAppt.name} onClick={(ev) => ev.stopPropagation()}>
            <h2>{sheetAppt.name}</h2>
            <p className="muted">{fmtTime(sheetAppt.time)} · {sheetAppt.minutes ?? DEFAULT_MINUTES} min · with {apptLeader(sheetAppt, names)}{sheetAppt.purpose ? ` · ${sheetAppt.purpose}` : ''}</p>
            {moving ? (
              <>
                <p className="wizard-q">Pick a new time</p>
                <SlotPicker minutes={sheetAppt.minutes ?? DEFAULT_MINUTES} roles={sheetRoles} ignoreId={sheetAppt.id} onPick={(slot) => moveTo(sheetAppt, slot)} />
                <div className="row actions"><button onClick={() => setMoving(false)}>Back</button></div>
              </>
            ) : (
              <div className="row actions">
                <button className="primary" onClick={() => setMoving(true)}>Move to another time</button>
                <button className="danger" onClick={() => remove(picked!)}>Remove</button>
                <button onClick={() => setPicked(null)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
      {dialog}
    </>
  )
}
