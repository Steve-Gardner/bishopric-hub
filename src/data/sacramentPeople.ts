import { findByName } from './nicknames'
import { PRAYER_ROLES } from './sacrament'
import { memberStore } from './store'
import type { Member, SacramentEntry, SacramentRole, Youth } from './types'

export interface Who { memberId?: string; youthId?: string }

// Who a typed name refers to, without changing anything: a ward member, or for a prayer someone on the Youth Roster.
export function lookupPerson(role: SacramentRole, typed: string, members: Member[], youth: Youth[]): Who | null {
  const m = findByName(members, typed)
  if (m) return { memberId: m.id }
  const y = PRAYER_ROLES.includes(role) ? youth.find((x) => x.name.toLowerCase() === typed.trim().toLowerCase()) : undefined
  return y ? { youthId: y.id } : null
}

// The same, but anyone new is added to Ward Members.
export async function resolvePerson(role: SacramentRole, typed: string, members: Member[], youth: Youth[]): Promise<Who> {
  const found = lookupPerson(role, typed, members, youth)
  if (found) return found
  const member: Member = { id: crypto.randomUUID(), name: typed.trim() }
  await memberStore.save(member)
  return { memberId: member.id }
}

// The entry that already gives this person a part in the meeting, if any (one person can't have two parts).
export function conflictFor(entries: SacramentEntry[], who: Who, ignoreId?: string): SacramentEntry | undefined {
  return entries.find((e) => e.id !== ignoreId && (who.memberId ? e.memberId === who.memberId : who.youthId ? e.youthId === who.youthId : false))
}

const PARTS: SacramentRole[] = ['youth-speaker', 'adult-speaker', 'speaker', 'musical', 'choir']

// A new entry placed where it belongs in the program: an opening prayer after the first hymn, a closing prayer
// last, and a speaker after the last speaker or musical number already there (or, when there are none, before the
// closing hymn). Returns the whole program, in order, with each entry's place written into `order`.
export function placeEntry(sorted: SacramentEntry[], entry: SacramentEntry): SacramentEntry[] {
  const all = [...sorted]
  const lastPart = all.map((e) => PARTS.includes(e.role)).lastIndexOf(true)
  const hymns = all.flatMap((e, i) => (e.role === 'hymn' ? [i] : []))
  const closingPrayer = all.findIndex((e) => e.role === 'benediction')
  let at: number
  if (entry.role === 'invocation') at = all[0]?.role === 'hymn' ? 1 : 0
  else if (entry.role === 'benediction') at = all.length
  else if (lastPart >= 0) at = lastPart + 1
  else if (hymns.length >= 3) at = hymns[hymns.length - 1]
  else at = closingPrayer >= 0 ? closingPrayer : all.length
  all.splice(at, 0, entry)
  return all.map((e, i) => ({ ...e, order: i }))
}
