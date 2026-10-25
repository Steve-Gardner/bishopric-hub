import { roleLabel, type RoleKey } from './roles'
import { sundayStore } from './store'
import type { SundayNote } from './types'

export { defaultPlan, type Plan } from './conductingRules'
import { defaultPlan } from './conductingRules'

// Who holds each role, by role key. Falls back to the role's title when no name has been entered.
export type Names = Record<string, string>

export const nameFor = (role: RoleKey | null, names: Names): string =>
  role ? names[role]?.trim() || roleLabel(role) || '' : ''

export interface SundayPlan {
  conducting: string
  note: string
  overridden: boolean
}

// What a Sunday really shows: the rule's answer, replaced by anything the viewer changed.
export function sundayPlan(dateIso: string, stored: SundayNote | undefined, names: Names): SundayPlan {
  const base = defaultPlan(dateIso)
  return {
    conducting: stored?.conducting ?? nameFor(base.role, names),
    note: stored?.note ?? base.note,
    overridden: stored?.note !== undefined || stored?.conducting !== undefined,
  }
}

// Saves a change to one Sunday. A value equal to what the rules give is not stored as an override.
export async function setSunday(
  dateIso: string,
  change: { note?: string; conducting?: string },
  names: Names,
): Promise<void> {
  const base = defaultPlan(dateIso)
  const current = (await sundayStore.list()).find((n) => n.id === dateIso)
  const next: SundayNote = { id: dateIso, date: dateIso, note: current?.note, conducting: current?.conducting }

  if (change.note !== undefined) next.note = change.note.trim() === base.note ? undefined : change.note.trim()
  if (change.conducting !== undefined) {
    const value = change.conducting.trim()
    next.conducting = value === nameFor(base.role, names) ? undefined : value
  }

  if (next.note === undefined && next.conducting === undefined) await sundayStore.remove(dateIso)
  else await sundayStore.save(next)
}

export async function resetSunday(dateIso: string): Promise<void> {
  await sundayStore.remove(dateIso)
}

