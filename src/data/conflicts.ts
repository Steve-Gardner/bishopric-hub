import { addDays, format, parseISO } from 'date-fns'
import { apptPeople, eventPeople, personLabel } from './people'
export { peopleIn, personLabel } from './people'
import { occursOn } from './recurrence'
import type { Appointment, CalendarEvent, EventType } from './types'

// Double booking: one person in two places at once. See people.ts for how a person is identified.
export const APPOINTMENT_MINUTES = 10 // how long an appointment runs when no length was given
const DEFAULT_EVENT_MINUTES = 60 // an event with a start time but no end time

export interface Booking {
  id: string
  source: 'event' | 'appointment'
  label: string
  date: string
  start: number // minutes after midnight
  end: number
  people: string[] // role keys, or lowercase names for anyone else
  type?: EventType
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const clock = (m: number) => format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60), 'h:mm a')

export function eventBooking(e: CalendarEvent, date: string, names: Record<string, string>): Booking | null {
  if (!e.time) return null // no time: nothing to overlap
  const start = toMin(e.time)
  return {
    id: e.id, source: 'event', label: e.title, date, type: e.type, people: eventPeople(e, names),
    start, end: e.endTime ? Math.max(toMin(e.endTime), start + 1) : start + DEFAULT_EVENT_MINUTES,
  }
}

export function appointmentBooking(a: Appointment, names: Record<string, string>): Booking | null {
  if (!a.time) return null
  const start = toMin(a.time)
  return { id: a.id, source: 'appointment', label: `${a.name}${a.purpose ? ` (${a.purpose})` : ''}`, date: a.date, start, end: start + (a.minutes ?? APPOINTMENT_MINUTES), people: apptPeople(a, names) }
}

export interface Conflict {
  message: string
  key: string // the same clash on other dates of a repeating event shares this
}

// Is `candidate` double booking anyone against `others` on the same day? An interview or appointment inside
// an "Interviews & Callings" block is the point of that block, so appointments only clash with other
// appointments and with events that are not interviews.
export function conflictsFor(candidate: Booking, others: Booking[], names: Record<string, string>): Conflict[] {
  const out: Conflict[] = []
  for (const o of others) {
    if (o.id === candidate.id || o.date !== candidate.date) continue
    if (candidate.source !== o.source && (candidate.type === 'interview' || o.type === 'interview')) continue
    const shared = candidate.people.filter((p) => o.people.includes(p))
    if (!shared.length || !(candidate.start < o.end && o.start < candidate.end)) continue
    const who = shared.map((p) => personLabel(p, names)).join(' and ')
    out.push({
      key: `${shared.join()}|${o.id}|${o.start}`,
      message: `${who} is already booked for ${o.label} on ${format(parseISO(o.date), 'EEE, MMM d')}, ${clock(o.start)} to ${clock(o.end)}`,
    })
  }
  return out
}

// Check a calendar event, including every date a repeating event lands on over the next year.
export function eventConflicts(
  event: CalendarEvent, events: CalendarEvent[], appointments: Appointment[], names: Record<string, string>, todayIso: string,
): Conflict[] {
  if (!event.time || !eventPeople(event, names).length) return []
  const others = events.filter((e) => e.id !== event.id && e.id !== event.seriesId)
  const dates: string[] = []
  if (!event.recurrence) dates.push(event.date)
  else {
    let d = parseISO(event.date > todayIso ? event.date : todayIso)
    for (let i = 0; i < 366; i++, d = addDays(d, 1)) {
      const day = format(d, 'yyyy-MM-dd')
      if (occursOn(event, day)) dates.push(day)
    }
  }
  const found: (Conflict & { more: number })[] = []
  for (const date of dates) {
    const mine = eventBooking(event, date, names)
    if (!mine) continue
    const pool = [
      ...others.filter((e) => occursOn(e, date)).map((e) => eventBooking(e, date, names)),
      ...appointments.filter((a) => a.date === date).map((a) => appointmentBooking(a, names)),
    ].filter((b): b is Booking => !!b)
    for (const c of conflictsFor(mine, pool, names)) {
      const same = found.find((f) => f.key === c.key)
      if (same) same.more++
      else found.push({ ...c, more: 0 })
    }
  }
  // A repeating event that clashes the same way every time is reported once, with how often it happens.
  return found.slice(0, 5).map((f) => ({ key: f.key, message: `${f.message}${f.more ? ` (and ${f.more} more date${f.more === 1 ? '' : 's'} in the next year)` : ''}.` }))
}

// Check a new appointment against the day's other appointments and events.
export function appointmentConflicts(
  appt: Appointment, events: CalendarEvent[], appointments: Appointment[], names: Record<string, string>,
): Conflict[] {
  const mine = appointmentBooking(appt, names)
  if (!mine) return []
  const pool = [
    ...events.filter((e) => occursOn(e, appt.date)).map((e) => eventBooking(e, appt.date, names)),
    ...appointments.filter((a) => a.date === appt.date && a.id !== appt.id).map((a) => appointmentBooking(a, names)),
  ].filter((b): b is Booking => !!b)
  return conflictsFor(mine, pool, names).map((c) => ({ ...c, message: `${c.message}.` }))
}
