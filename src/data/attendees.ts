import { PRESIDENCY, peopleIn } from './people'
import type { RoleKey } from './roles'

// Who attends a meeting, as the checkboxes show it: which of the bishop and his counselors, and anyone else typed.
export interface Attendees {
  roles: RoleKey[]
  others: string // comma-separated names outside the bishopric
}

export const everyone = (): Attendees => ({ roles: [...PRESIDENCY], others: '' })

// Splits older free text ("Bishopric", "Bishop Hale, Brother Baker, Primary Presidency") into the bishopric
// members it names, by role, and the rest.
export function splitAttendees(text: string | undefined, names: Record<string, string>): Attendees {
  const roles = new Set<RoleKey>()
  const others: string[] = []
  for (const raw of (text ?? '').split(/,|&|\/|\band\b/)) {
    const part = raw.trim()
    if (!part) continue
    const found = peopleIn(part, names).filter((t): t is RoleKey => PRESIDENCY.includes(t as RoleKey))
    if (found.length) found.forEach((t) => roles.add(t))
    else others.push(part)
  }
  return { roles: PRESIDENCY.filter((r) => roles.has(r)), others: others.join(', ') }
}
