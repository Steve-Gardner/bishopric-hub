import { addDays, format, parseISO } from 'date-fns'
import type { CalendarEvent, Recurrence } from './types'

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const NTH_LABELS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: 'Last' }

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

// Which occurrence of its weekday a date is within its month (1-5).
const nthOfMonth = (d: Date) => Math.ceil(d.getDate() / 7)

// True when `d` is the last of its weekday in the month.
const isLastOfMonth = (d: Date) => addDays(d, 7).getMonth() !== d.getMonth()

export function occursOn(event: CalendarEvent, dateIso: string): boolean {
  if (!event.date) return false // a meeting that has been made but not yet placed on the schedule
  const r = event.recurrence
  if (!r) return event.date === dateIso
  if (dateIso < event.date) return false
  if (r.until && dateIso > r.until) return false
  if (event.exceptions?.includes(dateIso)) return false

  const d = parseISO(dateIso)
  const start = parseISO(event.date)
  switch (r.kind) {
    case 'weekly':
      return d.getDay() === start.getDay()
    case 'monthly-date':
      return d.getDate() === start.getDate()
    case 'monthly-nth':
      return (
        d.getDay() === (r.weekday ?? start.getDay()) &&
        (r.nth === 5 ? isLastOfMonth(d) : nthOfMonth(d) === (r.nth ?? nthOfMonth(start)))
      )
  }
}

export function describeRecurrence(event: CalendarEvent): string {
  const r = event.recurrence
  if (!r) return ''
  const start = parseISO(event.date)
  let text: string
  if (r.kind === 'weekly') text = `Every ${WEEKDAYS[start.getDay()]}`
  else if (r.kind === 'monthly-date') text = `Monthly on the ${start.getDate()}`
  else text = `${NTH_LABELS[r.nth ?? nthOfMonth(start)]} ${WEEKDAYS[r.weekday ?? start.getDay()]} of the month`
  return r.until ? `${text} until ${format(parseISO(r.until), 'MMM d, yyyy')}` : text
}

// Default recurrence settings for a start date, so the form opens sensibly.
export function defaultRecurrence(startIso: string): Recurrence {
  const d = parseISO(startIso)
  return { kind: 'weekly', nth: Math.min(4, nthOfMonth(d)), weekday: d.getDay() }
}

export interface Occurrence {
  event: CalendarEvent
  date: string
}

// The next `limit` occurrences on or after `fromIso`, looking up to a year ahead.
export function upcoming(events: CalendarEvent[], fromIso: string, limit: number): Occurrence[] {
  const out: Occurrence[] = []
  let d = parseISO(fromIso)
  for (let i = 0; i < 366 && out.length < limit; i++, d = addDays(d, 1)) {
    const day = iso(d)
    events
      .filter((e) => occursOn(e, day))
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
      .forEach((event) => out.length < limit && out.push({ event, date: day }))
  }
  return out
}

export function eventsOnDay(events: CalendarEvent[], dateIso: string): CalendarEvent[] {
  return events
    .filter((e) => occursOn(e, dateIso))
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
}

// The nearest meeting before (dir -1) or after (dir 1) a date, looking up to ~10 weeks away.
// Returns null when none of the given events fall in that window.
export function adjacentMeeting(events: CalendarEvent[], dateIso: string, dir: 1 | -1, maxDays = 70): string | null {
  let d = parseISO(dateIso)
  for (let i = 0; i < maxDays; i++) {
    d = addDays(d, dir)
    const day = iso(d)
    if (events.some((e) => occursOn(e, day))) return day
  }
  return null
}

// The first meeting on or after a date, or null if there is none in the next ~10 weeks.
export function nextMeeting(events: CalendarEvent[], fromIso: string, maxDays = 70): string | null {
  if (events.some((e) => occursOn(e, fromIso))) return fromIso
  return adjacentMeeting(events, fromIso, 1, maxDays)
}
