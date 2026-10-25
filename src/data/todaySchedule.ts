import { apptPeople, eventPeople } from './people'
import type { RoleKey } from './roles'
import type { Appointment, CalendarEvent } from './types'
import { APPOINTMENT_MINUTES } from './conflicts'

// The three columns of the Bishopric agenda's Today's Schedule.
export const PRESIDENCY_COLUMNS: RoleKey[] = ['bishop', 'first-counselor', 'second-counselor']

export interface ScheduleItem {
  id: string
  source: 'event' | 'appointment'
  title: string
  detail?: string
  start?: string // HH:mm
  end?: string // HH:mm
  columns: number[] // which of the three columns this belongs to (0 = Bishop)
  agenda?: CalendarEvent['agenda'] // for an event: which agenda its Agenda button opens
}

export interface Placed {
  item: ScheduleItem
  column: number // first column, 0-2
  span: number // how many columns it crosses
  row: number // 1-based grid row
}

// What the three presidency members are doing on a date: the calendar events assigned to them, and their
// appointments. `events` are the events already on that date. Anything assigned to none of them is left out.
export function presidencyItems(
  events: CalendarEvent[], appointments: Appointment[], names: Record<string, string>,
): ScheduleItem[] {
  const columnsFor = (people: string[]) => PRESIDENCY_COLUMNS.flatMap((role, i) => (people.includes(role) ? [i] : []))
  const items: ScheduleItem[] = []
  for (const e of events) {
    const columns = columnsFor(eventPeople(e, names))
    if (columns.length) items.push({ id: e.id, source: 'event', title: e.title, detail: e.location, start: e.time, end: e.endTime, columns, agenda: e.agenda })
  }
  for (const a of appointments) {
    const columns = columnsFor(apptPeople(a, names))
    if (columns.length && a.date) {
      items.push({ id: a.id, source: 'appointment', title: a.name, detail: a.purpose || undefined, start: a.time || undefined, end: a.time ? addMinutes(a.time, a.minutes ?? APPOINTMENT_MINUTES) : undefined, columns })
    }
  }
  return items
}

const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const addMinutes = (t: string, add: number): string => {
  const total = toMinutes(t) + add
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// The pieces an item is drawn as: one piece across neighbouring columns, or one per column when they are apart.
export function splitColumns(item: ScheduleItem): { item: ScheduleItem; column: number; span: number }[] {
  const cols = [...new Set(item.columns)].sort((a, b) => a - b)
  const contiguous = cols.every((c, i) => i === 0 || c === cols[i - 1] + 1)
  return contiguous ? [{ item, column: cols[0], span: cols.length }] : cols.map((c) => ({ item, column: c, span: 1 }))
}

// Lay items out on a three-column grid in time order. An item for people in neighbouring columns crosses them;
// if its columns are not next to each other (Bishop and 2nd Counselor but not the 1st), it is shown once in
// each. Items at the same time share a row when their columns are free.
export function layoutSchedule(items: ScheduleItem[]): Placed[] {
  const pieces = items.flatMap(splitColumns)
  // Untimed items first, then by start time; ties keep their order.
  const sorted = pieces
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.item.start ?? '').localeCompare(b.p.item.start ?? '') || a.i - b.i)
    .map((x) => x.p)

  const rows: { start: string; used: Set<number> }[] = []
  const placed: Placed[] = []
  for (const p of sorted) {
    const start = p.item.start ?? ''
    const need = Array.from({ length: p.span }, (_, k) => p.column + k)
    let r = rows.findIndex((row) => row.start === start && need.every((c) => !row.used.has(c)))
    if (r === -1) { rows.push({ start, used: new Set() }); r = rows.length - 1 }
    need.forEach((c) => rows[r].used.add(c))
    placed.push({ item: p.item, column: p.column, span: p.span, row: r + 1 })
  }
  return placed
}
