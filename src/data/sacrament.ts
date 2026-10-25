import type { SacramentEntry, SacramentRole } from './types'

export interface FieldSpec {
  key: string // 'person' picks someone from the ward roster, 'youth' someone from the Youth Roster; anything else is stored in the entry's details
  label: string
  placeholder?: string
  required?: boolean
}

export interface EntryType {
  role: SacramentRole
  label: string
  fields: FieldSpec[]
  // When none of the fields is marked required, at least one of these must be filled in.
  atLeastOne?: string[]
}

const person: FieldSpec = { key: 'person', label: 'Name', required: true, placeholder: 'Type or choose a name' }
const youthPerson: FieldSpec = { key: 'youth', label: 'Youth', required: true }
const topic: FieldSpec = { key: 'topic', label: 'Topic (optional)' }

// What can be added to a meeting, in the order it is offered. Each kind shows only the fields that apply to it.
export const ENTRY_TYPES: EntryType[] = [
  { role: 'invocation', label: 'Opening Prayer', fields: [person] },
  { role: 'benediction', label: 'Closing Prayer', fields: [person] },
  { role: 'youth-speaker', label: 'Youth Speaker', fields: [youthPerson, topic] },
  { role: 'adult-speaker', label: 'Adult Speaker', fields: [person, topic] },
  // Someone from outside the ward, such as a high councilor or their guest. Kept in the record, never on the ward roster.
  {
    role: 'speaker', label: 'Visiting Speaker',
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'affiliation', label: 'Who they are (e.g. High Councilor)' }, topic],
  },
  {
    role: 'hymn', label: 'Congregational Hymn', atLeastOne: ['number', 'title'],
    fields: [{ key: 'number', label: 'Hymn number', placeholder: 'e.g. 85' }, { key: 'title', label: 'Title' }],
  },
  {
    role: 'musical', label: 'Special Musical Number', atLeastOne: ['performers', 'title'],
    fields: [{ key: 'performers', label: 'Performer(s)' }, { key: 'title', label: 'Title' }],
  },
  {
    role: 'choir', label: 'Ward Choir Number',
    fields: [{ key: 'title', label: 'Song title', required: true }, { key: 'director', label: 'Director (optional)' }],
  },
]

export const ROLE_LABEL = Object.fromEntries(ENTRY_TYPES.map((t) => [t.role, t.label])) as Record<SacramentRole, string>

// Roles that count towards "Not asked lately".
export const SPEAKING_ROLES: SacramentRole[] = ['speaker', 'youth-speaker', 'adult-speaker']
export const PRAYER_ROLES: SacramentRole[] = ['invocation', 'benediction']

// Which of a kind's fields are missing? Returns a message, or null when the form is complete.
export function missingFields(type: EntryType, values: Record<string, string>): string | null {
  for (const f of type.fields) {
    if (f.required && !values[f.key]?.trim()) return `Enter ${f.label.toLowerCase()}.`
  }
  if (type.atLeastOne && !type.atLeastOne.some((k) => values[k]?.trim())) {
    const names = type.atLeastOne.map((k) => type.fields.find((f) => f.key === k)?.label.toLowerCase() ?? k)
    return `Enter ${names.join(' or ')}.`
  }
  return null
}

export interface EntryText {
  headline: string
  label: string
  sub?: string
}

// How an entry reads in a meeting's program. `name` is the person's name for prayers and speakers.
export function describeEntry(entry: Pick<SacramentEntry, 'role' | 'details'>, name?: string): EntryText {
  const d = entry.details ?? {}
  const label = ROLE_LABEL[entry.role] ?? entry.role
  switch (entry.role) {
    case 'hymn': {
      const head = [d.number ? `#${d.number}` : '', d.title ?? ''].filter(Boolean).join(' ')
      return { headline: head || label, label }
    }
    case 'musical':
      return { headline: d.title || d.performers || label, label, sub: d.title && d.performers ? d.performers : undefined }
    case 'choir':
      return { headline: d.title || label, label, sub: d.director ? `Directed by ${d.director}` : undefined }
    default:
      return {
        headline: name || d.name || 'Unknown', label,
        sub: [d.affiliation, d.topic ? `Topic: ${d.topic}` : ''].filter(Boolean).join(' · ') || undefined,
      }
  }
}

// Where entries without an explicit place go: a plain, familiar order for older records.
const LEGACY_RANK: Record<SacramentRole, number> = {
  invocation: 0, hymn: 5, 'youth-speaker': 10, 'adult-speaker': 11, speaker: 12, musical: 15, choir: 16, benediction: 20,
}

export const entryOrder = (e: Pick<SacramentEntry, 'role' | 'order'>): number => e.order ?? LEGACY_RANK[e.role] ?? 50

// A meeting's entries in program order. Ties keep the order they were stored in.
export function sortEntries<T extends Pick<SacramentEntry, 'role' | 'order'>>(entries: T[]): T[] {
  return entries.map((e, i) => ({ e, i })).sort((a, b) => entryOrder(a.e) - entryOrder(b.e) || a.i - b.i).map((x) => x.e)
}

// Give every entry of a meeting an explicit place (0, 1, 2...) after moving one up (-1) or down (1).
// Returns the entries with their new `order`, or null when the move isn't possible.
export function moveEntry<T extends Pick<SacramentEntry, 'role' | 'order'>>(entries: T[], index: number, dir: -1 | 1): T[] | null {
  const sorted = sortEntries(entries)
  const target = index + dir
  if (index < 0 || index >= sorted.length || target < 0 || target >= sorted.length) return null
  ;[sorted[index], sorted[target]] = [sorted[target], sorted[index]]
  return sorted.map((e, i) => ({ ...e, order: i }))
}

// The place for a new entry: after everything already in the meeting.
export const nextOrder = (entries: Pick<SacramentEntry, 'role' | 'order'>[]): number =>
  entries.length ? Math.max(...entries.map(entryOrder)) + 1 : 0

export interface YouthDue<Y> { youth: Y; last?: string; days: number }

// The youth roster ordered for choosing a speaker: never spoken first, then longest since they last spoke.
// Ties are alphabetical. `today` is yyyy-MM-dd.
export function youthByLastSpoke<Y extends { id: string; name: string }>(
  youth: Y[], entries: Pick<SacramentEntry, 'role' | 'youthId' | 'date'>[], today: string,
): YouthDue<Y>[] {
  const day = (iso: string) => Math.round(Date.parse(iso) / 86400000)
  return youth
    .map((y) => {
      const last = entries.filter((e) => e.youthId === y.id && e.role === 'youth-speaker' && e.date <= today).map((e) => e.date).sort().at(-1)
      return { youth: y, last, days: last ? day(today) - day(last) : Infinity }
    })
    .sort((a, b) => (b.days === a.days ? 0 : b.days > a.days ? 1 : -1) || a.youth.name.localeCompare(b.youth.name))
}

export type SpokeBucket = 'year' | 'two-years' | 'older'
export const SPOKE_BUCKETS: { key: SpokeBucket; label: string }[] = [
  { key: 'year', label: 'Last 12 months' },
  { key: 'two-years', label: '1-2 years ago' },
  { key: 'older', label: 'Over 2 years' },
]

// When did someone last speak: within 12 months, 1-2 years ago, or longer than 2 years ago? Someone who has
// never spoken counts as longer than 2 years. Both dates are yyyy-MM-dd.
export function spokeBucket(last: string | undefined, today: string): SpokeBucket {
  if (!last) return 'older'
  const days = (Date.parse(today) - Date.parse(last)) / 86400000
  return days <= 365 ? 'year' : days <= 730 ? 'two-years' : 'older'
}

// "Jamie Cruz" sorts as "cruz jamie": by last name, then the rest of the name.
export function lastNameKey(name: string): string {
  const parts = name.trim().toLowerCase().split(/\s+/)
  return [parts.at(-1) ?? '', ...parts.slice(0, -1)].join(' ')
}
