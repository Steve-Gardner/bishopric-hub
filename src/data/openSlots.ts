import { addDays, format, getDay } from 'date-fns'
import { appointmentConflicts } from './conflicts'
import type { RoleKey } from './roles'
import { specialMeeting } from './special'
import { resolveDay } from './sundayPlan'
import type { FamilyWeeks } from './schedule'
import type { Appointment, CalendarEvent, ScheduleEdit, ScheduleRow } from './types'

// Open interview times. The Sunday schedule says when interviews happen (the blocks that mention interviews,
// callings or temple recommends); within those windows, a time is open when the leader is not already in a
// meeting or another interview.

export interface Slot {
  date: string // yyyy-MM-dd
  start: string // HH:mm
  role: RoleKey
}

const STEP = 5 // minutes between start times that are tried
const INTERVIEW_WORDS = /interview|calling|temple rec/i

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export interface SlotInput {
  from: string // first day to look at (yyyy-MM-dd)
  weeks: number // how many Sundays to look through
  roles: RoleKey[]
  minutes: number
  rows: ScheduleRow[]
  edits: ScheduleEdit[]
  familyWeek: FamilyWeeks
  special: Record<string, string>
  events: CalendarEvent[]
  appts: Appointment[]
  names: Record<string, string>
  ignoreId?: string // an interview being moved does not block its own old time
  now?: Date
}

// Interview windows on a Sunday, as [start, end] in minutes after midnight.
export function interviewWindows(date: string, i: Pick<SlotInput, 'rows' | 'edits' | 'familyWeek' | 'special'>): [number, number][] {
  if (!specialMeeting(date, i.special).canSchedule) return []
  const plan = resolveDay(date, i.rows, i.edits, i.familyWeek, i.special)
  return plan.blocks
    .filter((b) => b.start && b.end && INTERVIEW_WORDS.test(b.text))
    .map((b): [number, number] => [toMin(b.start!), toMin(b.end!)])
    .sort((a, b) => a[0] - b[0])
}

// Open times, earliest first within each Sunday, packed one after another so no gap is left too short to use.
export function openSlots(i: SlotInput): Slot[] {
  const now = i.now ?? new Date()
  const today = format(now, 'yyyy-MM-dd')
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const out: Slot[] = []
  let day = new Date(`${i.from}T12:00:00`)
  while (getDay(day) !== 0) day = addDays(day, 1)
  for (let w = 0; w < i.weeks; w++, day = addDays(day, 7)) {
    const date = format(day, 'yyyy-MM-dd')
    if (date < today) continue
    const windows = interviewWindows(date, i)
    for (const role of i.roles) {
      for (const [from, to] of windows) {
        let t = from
        while (t + i.minutes <= to) {
          const candidate: Appointment = {
            id: i.ignoreId ?? 'candidate', date, leader: '', leaderRole: role, time: hhmm(t), name: '', purpose: '', minutes: i.minutes,
          }
          const late = date === today && t < nowMin
          if (!late && appointmentConflicts(candidate, i.events, i.appts, i.names).length === 0) {
            out.push({ date, start: hhmm(t), role })
            t += i.minutes
          } else t += STEP
        }
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
}
