import { getDate, parseISO } from 'date-fns'
import type { RoleKey } from './roles'

// The Conducting Schedule is calculated from these rules, so every month is filled in without any data entry.
//   1st Sunday   Fast Sunday. Bishop in the first month of a quarter (Jan, Apr, Jul, Oct),
//                1st Counselor in the second (Feb, May, Aug, Nov), 2nd Counselor in the third (Mar, Jun, Sep, Dec).
//   2nd Sunday   1st Counselor.
//   3rd Sunday   Bishop.
//   4th Sunday   2nd Counselor.
//   5th Sunday   not assigned.
//   April and October: General Conference takes the 1st Sunday (no one conducts), and Fast Sunday moves to
//   the 2nd Sunday, conducted by whoever would have had the 1st Sunday.
const FIRST_SUNDAY: RoleKey[] = ['bishop', 'first-counselor', 'second-counselor']

export interface Plan {
  role: RoleKey | null
  note: string
}

export function defaultPlan(dateIso: string): Plan {
  const d = parseISO(dateIso)
  const nth = Math.ceil(getDate(d) / 7)
  const month = d.getMonth()
  const firstSundayRole = FIRST_SUNDAY[month % 3]
  const conferenceMonth = month === 3 || month === 9 // April and October

  switch (nth) {
    case 1:
      return conferenceMonth ? { role: null, note: 'General Conference' } : { role: firstSundayRole, note: 'Fast Sunday' }
    case 2:
      return conferenceMonth ? { role: firstSundayRole, note: 'Fast Sunday' } : { role: 'first-counselor', note: '' }
    case 3:
      return { role: 'bishop', note: '' }
    case 4:
      return { role: 'second-counselor', note: '' }
    default:
      return { role: null, note: '' }
  }
}
