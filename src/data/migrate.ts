import { splitAttendees } from './attendees'
import { peopleIn } from './people'
import { ROLES } from './roles'
import { appointmentStore, eventStore, staffStore } from './store'

// Older data kept "who" as typed names ("Bishop Hale", "Bishopric"). Turn that into roles, using the names in
// Roles as they are right now, so a later rename in Roles can't break a schedule. Safe to run on every load:
// a record that is already in the new form is left alone, and so is anything that doesn't name a role.
export async function migrateIdentity(): Promise<void> {
  const names = Object.fromEntries((await staffStore.list()).map((s) => [s.id, s.name]))

  for (const e of await eventStore.list()) {
    if (e.attendees !== undefined || !e.assignedTo?.trim()) continue
    const { roles, others } = splitAttendees(e.assignedTo, names)
    if (!roles.length) continue // nothing names the bishopric: leave it as typed
    await eventStore.save({ ...e, attendees: roles, assignedTo: others || undefined })
  }

  for (const a of await appointmentStore.list()) {
    if (a.leaderRole || !a.leader) continue
    const role = peopleIn(a.leader, names).find((t) => ROLES.some((r) => r.key === t))
    if (role) await appointmentStore.save({ ...a, leaderRole: role as (typeof ROLES)[number]['key'] })
  }
}
