import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { useBlocker } from '../../components/useBlocker'
import { useStaff } from '../../components/useStaff'
import { APPOINTMENT_MINUTES, appointmentConflicts, eventConflicts } from '../../data/conflicts'
import { fmtRange, fmtTime } from '../../data/format'
import { defaultRecurrence, eventsOnDay } from '../../data/recurrence'
import { ROLES } from '../../data/roles'
import { attendeeLabel, leaderLabel as apptLeader } from '../../data/people'
import { appointmentStore, eventStore } from '../../data/store'
import { PRESIDENCY_COLUMNS, addMinutes, presidencyItems, splitColumns } from '../../data/todaySchedule'
import type { Appointment, CalendarEvent } from '../../data/types'

const PX = 3.4 // pixels per minute
const GUTTER = 44 // width of the time labels
const SNAP = 5 // a meeting snaps to the nearest 5 minutes
const DEFAULT_MINUTES = APPOINTMENT_MINUTES

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

interface Props {
  date: string
  appts: Appointment[]
  reload: () => void
  version: number // changes when a meeting is made elsewhere, to load the events again
  trayHost: HTMLElement | null // where the waiting blocks are shown: in the wizard's place, above
  onWaiting: (count: number) => void // how many are waiting, so the wizard knows whether to show its button
}

interface Drag { id: string; x: number; y: number; moved: boolean }

// The day as three columns (Bishop, 1st Counselor, 2nd Counselor) down a time line. Meetings that are made but
// not placed wait above it. Drag one onto a column and time and it takes that
// leader and start time; drag it somewhere else and both change with it.
export default function InterviewBoard({ date, appts, reload, version, trayHost, onWaiting }: Props) {
  const { names } = useStaff()
  const { block, dialog } = useBlocker()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const origin = useRef({ x: 0, y: 0 })

  const loadEvents = () => eventStore.list().then(setEvents)
  useEffect(() => { loadEvents() }, [date, version])

  const pending = appts.filter((a) => !a.date)
  const pendingMeetings = events.filter((e) => !e.date && e.type === 'meeting')
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

  // The column and snapped start time under a point, or null when it is outside the grid.
  const slotAt = (clientX: number, clientY: number) => {
    const r = grid.current?.getBoundingClientRect()
    if (!r) return null
    const x = clientX - r.left - GUTTER
    const y = clientY - r.top
    if (x < 0 || y < 0 || y > r.height || clientX > r.right) return null
    const col = Math.min(2, Math.floor(x / ((r.width - GUTTER) / 3)))
    return { col, start: Math.min(END - 5, START + Math.round(y / PX / SNAP) * SNAP) }
  }

  // Blocks are told apart by a prefix: a: for an interview, e: for a meeting.
  const place = async (key: string, slot: { col: number; start: number }) => {
    const [kind, id] = [key.slice(0, 1), key.slice(2)]
    if (kind === 'a') {
      const appt = appts.find((a) => a.id === id)
      if (!appt) return
      const moved: Appointment = { ...appt, date, leaderRole: PRESIDENCY_COLUMNS[slot.col], leader: leaderLabel(slot.col), time: hhmm(slot.start) }
      const clashes = appointmentConflicts(moved, events, await appointmentStore.list(), names)
      if (clashes.length) { block(clashes.map((c) => c.message)); return }
      await appointmentStore.save(moved)
      reload()
      return
    }
    // A meeting: the time comes from where it is dropped. A new one also takes the day, and a repeating one
    // repeats from that day. A meeting already placed keeps its day and only changes time (for every repeat).
    const ev = events.find((e) => e.id === id)
    if (!ev) return
    const length = ev.minutes ?? (ev.time && ev.endTime ? toMin(ev.endTime) - toMin(ev.time) : 60)
    const placing = !ev.date
    const { minutes: _length, ...rest } = ev
    const moved: CalendarEvent = {
      ...rest, date: placing ? date : ev.date, time: hhmm(slot.start), endTime: hhmm(slot.start + length),
      recurrence: placing && ev.recurrence ? { ...ev.recurrence, nth: defaultRecurrence(date).nth, weekday: defaultRecurrence(date).weekday } : ev.recurrence,
    }
    const clashes = eventConflicts(moved, await eventStore.list(), await appointmentStore.list(), names, format(new Date(), 'yyyy-MM-dd'))
    if (clashes.length) { block(clashes.map((c) => c.message)); return }
    await eventStore.save(moved)
    await loadEvents()
    reload()
  }

  const down = (id: string) => (ev: React.PointerEvent) => {
    ev.currentTarget.setPointerCapture(ev.pointerId)
    origin.current = { x: ev.clientX, y: ev.clientY }
    setDrag({ id, x: ev.clientX, y: ev.clientY, moved: false })
  }
  const move = (ev: React.PointerEvent) => {
    if (!drag) return
    const far = Math.hypot(ev.clientX - origin.current.x, ev.clientY - origin.current.y) > 6
    setDrag({ ...drag, x: ev.clientX, y: ev.clientY, moved: drag.moved || far })
  }
  const up = (ev: React.PointerEvent) => {
    if (!drag) return
    const { id, moved } = drag
    setDrag(null)
    if (!moved) return // a tap without dragging does nothing
    const slot = slotAt(ev.clientX, ev.clientY)
    if (slot) place(id, slot)
  }
  const remove = async (key: string) => {
    if (key.startsWith('a:')) await appointmentStore.remove(key.slice(2))
    else { await eventStore.remove(key.slice(2)); await loadEvents() }
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

  const preview = drag?.moved ? slotAt(drag.x, drag.y) : null
  const dragged = drag ? info(drag.id) : undefined
  const hours = Array.from({ length: (END - START) / 60 + 1 }, (_, i) => START + i * 60)
  const spanStyle = (col: number, span: number) => ({
    left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${col} / 3 + 2px)`,
    width: `calc((100% - ${GUTTER}px) * ${span} / 3 - 4px)`,
  })

  // A block you drag onto the time line.
  const chip = (key: string, extra?: string) => {
    const i = info(key)
    if (!i) return null
    return (
      <div
        key={key}
        className={`board-meeting ${drag?.id === key && drag.moved ? 'lifted' : ''} ${extra ?? ''}`}
        onPointerDown={down(key)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}
        role="img" aria-label={`${i.name}, ${i.minutes} minutes${i.time ? `, ${fmtTime(i.time)}` : ''}, ${i.detail}`}
      >
        <span><strong>{i.name}</strong> <span className="small">{i.minutes} min{i.time ? ` · ${fmtTime(i.time)}` : ''}</span></span>
      </div>
    )
  }
  const waiting = [...pending.map((a) => `a:${a.id}`), ...pendingMeetings.map((e) => `e:${e.id}`)]
  useEffect(() => { onWaiting(waiting.length) }, [waiting.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const interviewsOnly = pendingMeetings.length === 0
  const meetingsOnly = pending.length === 0
  const instructions = interviewsOnly
    ? 'Drag it onto the schedule below, in the column of who will conduct it.'
    : meetingsOnly
      ? 'Drag it onto the schedule below to set its time.'
      : 'Drag each onto the schedule below. An interview goes in the column of who will conduct it; a meeting only needs a time.'

  return (
    <>
      {trayHost && waiting.length > 0 && createPortal(
        <div className="board-tray">
          <p className="tray-note">{instructions}</p>
          <div className="tray-chips">
            {waiting.map((key) => (
              <span key={key} className="tray-item">
                {chip(key, 'in-tray')}
                <button className="danger" aria-label={`Remove ${info(key)?.name}`} onClick={() => remove(key)}>✕</button>
              </span>
            ))}
          </div>
        </div>,
        trayHost,
      )}
      <div className="board-heads" style={{ paddingLeft: GUTTER }}>
        {PRESIDENCY_COLUMNS.map((role, i) => (
          <div key={role} className="today-head">
            <strong>{ROLES.find((r) => r.key === role)?.label}</strong>
            {names[role]?.trim() && <span className="muted small">{names[role]}</span>}
            <span className="sr-only">{leaderLabel(i)}</span>
          </div>
        ))}
      </div>

      <div className="board" ref={grid} style={{ height: (END - START) * PX }}>
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
              {p.item.source === 'appointment' && (
                <button className="danger board-x" aria-label={`Remove ${p.item.title}`} onClick={(ev2) => { ev2.stopPropagation(); remove(key) }}>✕</button>
              )}
            </div>
          )
        })}
        {preview && dragged && (
          <div
            className="board-preview"
            style={{ ...spanStyle(dragged.span === 3 ? 0 : preview.col, dragged.span), top: (preview.start - START) * PX, height: dragged.minutes * PX }}
          >
            {dragged.span === 1 ? `${leaderLabel(preview.col)} · ` : ''}{fmtTime(hhmm(preview.start))} to {fmtTime(addMinutes(hhmm(preview.start), dragged.minutes))}
          </div>
        )}
      </div>
      <p className="muted small">{format(parseISO(date), 'EEEE, MMM d')}. Other things on the bishopric's calendar show in gray. Drag a meeting that is already placed to change its time.</p>
      {drag?.moved && dragged && <div className="board-ghost" style={{ left: drag.x, top: drag.y }}>{dragged.name}</div>}
      {dialog}
    </>
  )
}
