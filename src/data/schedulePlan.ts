import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns'
import { eventStore } from './store'
import { occursOn } from './recurrence'
import type { CalendarEvent } from './types'

// The Monthly Schedule board moves whole meetings (events with an agenda, such as Ward Council and the
// Bishopric Meeting) between Sundays. Moving one occurrence of a repeating meeting skips that date on the
// series and creates a one-off copy on the new date that remembers where it came from, so it can be undone.

export const isBoardMeeting = (e: CalendarEvent) => e.agenda === 'bishopric' || e.agenda === 'council'

export interface Chip {
  event: CalendarEvent
  date: string
  state: 'active' | 'skipped' | 'moved-away'
  movedTo?: string // for 'moved-away': where the meeting went
}

export interface BoardRow {
  date: string
  chips: Chip[]
}

export const sundaysOf = (month: Date): string[] =>
  eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
    .filter((d) => d.getDay() === 0)
    .map((d) => format(d, 'yyyy-MM-dd'))

export function buildBoard(events: CalendarEvent[], month: Date): BoardRow[] {
  const meetings = events.filter(isBoardMeeting)
  return sundaysOf(month).map((date) => {
    const chips: Chip[] = []
    for (const event of meetings) {
      if (occursOn(event, date)) {
        chips.push({ event, date, state: 'active' })
      } else if (event.recurrence && event.exceptions?.includes(date) && occursOn({ ...event, exceptions: [] }, date)) {
        // The series would meet this Sunday but has been skipped or moved away.
        const copy = meetings.find((m) => m.seriesId === event.id && m.movedFrom === date)
        chips.push({ event, date, state: copy ? 'moved-away' : 'skipped', movedTo: copy?.date })
      }
    }
    chips.sort((a, b) => (a.event.time ?? '').localeCompare(b.event.time ?? ''))
    return { date, chips }
  })
}

// Can this meeting go to `to`? Not if the same kind of meeting is already there.
export const canMoveTo = (events: CalendarEvent[], event: CalendarEvent, to: string) =>
  !events.some((e) => e.agenda === event.agenda && e.id !== event.id && occursOn(e, to)) && !occursOn(event, to)

// Put a moved meeting back on its original date.
export async function undoMove(events: CalendarEvent[], moved: CalendarEvent) {
  const series = events.find((e) => e.id === moved.seriesId)
  if (series) await eventStore.save({ ...series, exceptions: (series.exceptions ?? []).filter((d) => d !== moved.movedFrom) })
  await eventStore.remove(moved.id)
}

export async function moveMeeting(events: CalendarEvent[], event: CalendarEvent, from: string, to: string) {
  if (event.movedFrom === to) return undoMove(events, event)
  if (!event.recurrence) return eventStore.save({ ...event, date: to })
  await eventStore.save({ ...event, exceptions: [...(event.exceptions ?? []), from] })
  await eventStore.save({
    id: crypto.randomUUID(), title: event.title, type: event.type, date: to, time: event.time, endTime: event.endTime,
    attendees: event.attendees, assignedTo: event.assignedTo, agenda: event.agenda, location: event.location, notes: event.notes,
    movedFrom: from, seriesId: event.id,
  })
}

export const skipMeeting = (event: CalendarEvent, date: string) =>
  eventStore.save({ ...event, exceptions: [...(event.exceptions ?? []), date] })

// Bring a skipped or moved-away meeting back.
export async function restoreMeeting(events: CalendarEvent[], chip: Chip) {
  const copy = events.find((e) => e.seriesId === chip.event.id && e.movedFrom === chip.date)
  if (copy) return undoMove(events, copy)
  await eventStore.save({ ...chip.event, exceptions: (chip.event.exceptions ?? []).filter((d) => d !== chip.date) })
}

// Undo every move and skip shown for the month.
export async function resetMonth(month: Date) {
  let events = await eventStore.list()
  for (const row of buildBoard(events, month)) {
    for (const chip of row.chips) {
      if (chip.state === 'active' && chip.event.movedFrom) await undoMove(events, chip.event)
      else if (chip.state !== 'active') await restoreMeeting(events, chip)
      events = await eventStore.list()
    }
  }
}
