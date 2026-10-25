import { ROLES, type RoleKey } from './roles'
import type { Appointment, CalendarEvent } from './types'

// Who is who. A meeting's attendees and an appointment's leader are kept as role keys ('bishop',
// 'first-counselor'...), and the name shown comes from Roles when it is drawn. So renaming someone in Roles
// never breaks their schedule. Anyone outside the bishopric is typed text, matched by name.
export const PRESIDENCY: RoleKey[] = ['bishop', 'first-counselor', 'second-counselor']

// Who a piece of free text names: role keys, or lowercase names for anyone else. "Bishopric" means all three.
export function peopleIn(text: string | undefined, names: Record<string, string>): string[] {
  const out = new Set<string>()
  for (const raw of (text ?? '').toLowerCase().split(/,|&|\/|\band\b/)) {
    const part = raw.trim()
    if (!part) continue
    if (part === 'bishopric') { PRESIDENCY.forEach((p) => out.add(p)); continue }
    const role = ROLES.find((r) => r.label.toLowerCase() === part || names[r.key]?.trim().toLowerCase() === part)
    out.add(role ? role.key : part)
  }
  return [...out]
}

// A person as they read in a message: their name if Roles has one, otherwise the role title.
export function personLabel(token: string, names: Record<string, string>): string {
  const role = ROLES.find((r) => r.key === token)
  return role ? names[role.key]?.trim() || role.label : token.replace(/\b\w/g, (c) => c.toUpperCase())
}

type HasAttendees = Pick<CalendarEvent, 'attendees' | 'assignedTo'>
type HasLeader = Pick<Appointment, 'leaderRole' | 'leader'>

// Everyone attending a meeting: the roles chosen, plus anyone named in the free text.
export const eventPeople = (e: HasAttendees, names: Record<string, string>): string[] =>
  [...new Set([...(e.attendees ?? []), ...peopleIn(e.assignedTo, names)])]

export const apptPeople = (a: HasLeader, names: Record<string, string>): string[] =>
  a.leaderRole ? [a.leaderRole] : peopleIn(a.leader, names)

// How attendees read on screen: "Bishopric" for all three, otherwise their names, then anyone else typed.
export function attendeeLabel(e: HasAttendees, names: Record<string, string>): string {
  const roles = PRESIDENCY.filter((r) => e.attendees?.includes(r))
  const head = roles.length === PRESIDENCY.length ? ['Bishopric'] : roles.map((r) => personLabel(r, names))
  return [...head, e.assignedTo?.trim() ?? ''].filter(Boolean).join(', ')
}

export const leaderLabel = (a: HasLeader, names: Record<string, string>): string =>
  a.leaderRole ? personLabel(a.leaderRole, names) : a.leader
