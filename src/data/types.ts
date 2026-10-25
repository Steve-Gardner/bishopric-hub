import type { RoleKey } from './roles'
export type EventType = 'interview' | 'meeting' | 'assignment' | 'activity' | 'other'

export type RecurKind = 'weekly' | 'monthly-nth' | 'monthly-date'

export interface Recurrence {
  kind: RecurKind
  nth?: number // monthly-nth: 1-4, or 5 for "last"
  weekday?: number // monthly-nth: 0 (Sunday) - 6
  until?: string // yyyy-MM-dd, inclusive; open-ended when absent
}

export interface CalendarEvent {
  id: string
  title: string
  type: EventType
  date: string // yyyy-MM-dd; the first day of a recurring event
  time?: string // start time, HH:mm
  endTime?: string // HH:mm
  attendees?: RoleKey[] // the bishop and counselors attending, by role, so the name shown follows Roles
  assignedTo?: string // anyone else attending, typed (older events kept everyone here)
  notes?: string
  recurrence?: Recurrence
  exceptions?: string[] // dates of a recurring event that are skipped
  agenda?: 'checklist' | 'bishopric' | 'council' // which agenda the Agenda button opens (checklist when absent)
  location?: string
  youthGroups?: ActivityGroup[] // set on youth activities; the Youth tab lists events that have any
  movedFrom?: string // yyyy-MM-dd: this one-off is a meeting moved here from that date of the series below
  seriesId?: string // the repeating event this was moved out of
  minutes?: number // how long a meeting runs while it is made but not yet placed on the schedule (its date is empty until then)
}

export const EVENT_TYPES: Record<EventType, string> = {
  interview: 'Interview',
  meeting: 'Meeting',
  assignment: 'Assignment',
  activity: 'Activity',
  other: 'Other',
}

export interface Member {
  id: string
  name: string
}

// Everything that can appear in a sacrament meeting program. 'speaker' is how speakers were recorded before
// youth and adult speakers were separated; it still displays as "Speaker".
export type SacramentRole =
  | 'invocation' | 'benediction' | 'youth-speaker' | 'adult-speaker' | 'hymn' | 'musical' | 'choir' | 'speaker'

export interface SacramentEntry {
  id: string
  date: string // yyyy-MM-dd (the Sunday)
  role: SacramentRole
  memberId?: string // the person, for prayers and adult speakers (they are tracked in "Not asked lately")
  youthId?: string // the young man or young woman, for a youth speaker (from the Youth Roster in Setup)
  details?: Record<string, string> // the other fields for this kind of item: topic, hymn number, title, performers...
  order?: number // place in the program; entries without one fall back to a sensible order for their kind
}

// Sensitive: keep to name + status only. Never store blessing content.
export type BlessingStatus = 'not-yet' | 'scheduled' | 'received'
export type YouthGroup = 'young-men' | 'young-women'

export interface Youth {
  id: string
  name: string
  group: YouthGroup
  status: BlessingStatus
  appointmentDate?: string // yyyy-MM-dd, only meaningful when scheduled
}

export const BLESSING_STATUS: Record<BlessingStatus, string> = {
  'not-yet': 'Not yet',
  scheduled: 'Scheduled',
  received: 'Received',
}

export const YOUTH_GROUPS: Record<YouthGroup, string> = {
  'young-men': 'Young Man',
  'young-women': 'Young Woman',
}

// A quick-reference line. `value` is shown as a link when it starts with http(s).
export interface FsyRef {
  id: string
  category: string
  label: string
  value: string
}

// Generic ordered list used across the Agenda module (agenda items, to-dos, goals, org notes...).
export interface ListItem {
  id: string
  list: string // which list this belongs to, e.g. 'agenda', 'goals', 'org:primary'
  text: string
  done?: boolean
  notes?: string // optional extra detail, opened with the item's notes button
  order: number
}

export type Tone = 'none' | 'green' | 'yellow' | 'gray' | 'blue'

// One time slot of the Sunday schedule. If `all` is set it spans every week column.
export interface ScheduleRow {
  id: string
  order: number
  start?: string // HH:mm
  end?: string // HH:mm
  time?: string // older rows had one free-text time label; shown (and converted to a start time) when no start is set
  all: string
  overFamily?: boolean // run across the Family Sunday block instead of stopping at it; unset means the 2-hour block does
  weeks: string[] // length 5, Week 1..5
  tone: Tone
  year?: number // a schedule planned for that year only; rows without a year are shared by every year that has none of its own
}

export interface Appointment {
  id: string
  date: string // yyyy-MM-dd; empty while the meeting is made but not yet placed on the schedule
  leader: string // the name shown when it was booked; empty until placed
  leaderRole?: RoleKey // who it is with, by role, so the name shown follows Roles
  time: string // HH:mm; empty until placed
  name: string
  purpose: string
  minutes?: number // how long it runs
}

export interface Gathering {
  id: string
  name: string
  ordinance: string
  plan: string
}

// A change to one Sunday of the Conducting Schedule. The schedule is calculated from rules; a field that is
// present here (even an empty string) replaces the calculated value, and an absent field uses the rule.
export interface SundayNote {
  id: string // the date, yyyy-MM-dd
  date: string
  note?: string // e.g. Fast Sunday, Primary Program
  conducting?: string // who conducts
}


// Who gives the gratitude statement / roles and responsibilities on a given Sunday.
export interface GratitudeAssignment {
  id: string
  date: string // yyyy-MM-dd
  person: string
}

// A person on the agenda who stays there from week to week, with private notes.
export type PersonKind = 'individual' | 'spiritual-need'

export interface Individual {
  id: string
  kind: PersonKind
  name: string
  notes?: string // private to the bishopric; never shown on the Ward Council side
  councilNotes?: string // written on the Ward Council side; the bishopric sees them, but the notes above never go the other way
  hideFromCouncil?: boolean // keep this person off the Ward Council agenda until turned back on
  order: number
}

// Ward Council agenda content for one meeting date: who has each role, each organization's report,
// and the free-form extra notes. One row per (kind, date, key), with id `${kind}:${date}:${key}`.
export type CouncilKind = 'role' | 'report' | 'notes'

export interface CouncilEntry {
  id: string
  date: string // yyyy-MM-dd
  kind: CouncilKind
  key: string
  text: string
}

// Records that a meeting's agenda has already had the previous meeting's open items carried into it,
// so an item deleted afterwards is not brought back. id is `${agendaType}:${date}`.
export interface CarryMark {
  id: string
}

// The name of whoever holds a leadership role (id is the role key, e.g. 'bishop'), so the
// Conducting Schedule can show "Bishop Smith" instead of just "Bishop".
export interface StaffName {
  id: string
  name: string
}

// A single remembered choice, such as which week of the month is Family Sunday.
export interface Setting {
  id: string
  value: string
}

// Ward Council assignments for one meeting: unlike the Bishopric Meeting, the gratitude and scripture
// and the roles and responsibilities are given by two different people.
export interface CouncilAssignment {
  id: string
  date: string // yyyy-MM-dd
  gratitude?: string // Gratitude & Scripture
  roles?: string // Roles & Responsibilities
}

// Who a youth activity is for. Combined groups cover a whole organization; the rest are single classes/quorums.
export type ActivityGroup =
  | 'all' | 'ym' | 'deacons' | 'teachers' | 'priests' | 'yw' | 'builders' | 'gatherers' | 'messengers'

// Checkbox layout: "All Combined" stands alone; the quorums and classes sit under their organization,
// which can itself be ticked when the activity is for all of the young men or all of the young women.
export const ACTIVITY_GROUPS: { label?: string; options: { key: ActivityGroup; label: string }[] }[] = [
  { options: [{ key: 'all', label: 'All Combined' }] },
  {
    label: 'Young Men',
    options: [
      { key: 'ym', label: 'Young Men Combined' },
      { key: 'deacons', label: 'Deacons' },
      { key: 'teachers', label: 'Teachers' },
      { key: 'priests', label: 'Priests' },
    ],
  },
  {
    label: 'Young Women',
    options: [
      { key: 'yw', label: 'Young Women Combined' },
      { key: 'builders', label: 'Builders of Faith' },
      { key: 'gatherers', label: 'Gatherers of Light' },
      { key: 'messengers', label: 'Messengers of Hope' },
    ],
  },
]

export const ACTIVITY_GROUP_LABEL = Object.fromEntries(
  ACTIVITY_GROUPS.flatMap((g) => g.options.map((o) => [o.key, o.label])),
) as Record<ActivityGroup, string>

export const DEFAULT_ACTIVITY_LOCATION = 'The church'
export const DEFAULT_ACTIVITY_TIME = '18:30' // 6:30 PM
export const DEFAULT_ACTIVITY_END_TIME = '20:00' // 8:00 PM

// "All Combined", or the ticked groups in the order they appear in the picker.
export function describeGroups(groups: ActivityGroup[]): string {
  if (groups.includes('all')) return ACTIVITY_GROUP_LABEL.all
  return ACTIVITY_GROUPS.flatMap((g) => g.options).filter((o) => groups.includes(o.key)).map((o) => o.label).join(', ')
}

// A change to the Sunday schedule on one particular Sunday. The Sunday schedule table is the normal pattern
// (by week of the month); these edits sit on top of it for a single date and never change the pattern.
//   override  a table row on this date that is hidden (maybe moved elsewhere) or run at different times
//   extra     a block added to this date, or a table row's block moved here from another Sunday
//   family    Family Sunday forced on or off for this date (it normally follows the Family Sunday week)
export interface ScheduleEdit {
  id: string
  date: string // yyyy-MM-dd, the Sunday the change is on
  kind: 'override' | 'extra' | 'family'
  rowId?: string // override: the table row; extra: the row it was moved from, if any
  hidden?: boolean // override
  movedTo?: string // override/family: where the block went, when it was moved rather than removed
  text?: string // extra
  start?: string // override (new time) / extra
  end?: string
  tone?: Tone // extra
  movedFrom?: string // extra/family: the Sunday this was moved here from
  family?: boolean // family: true = this is Family Sunday, false = it is not
}

// Who teaches a young men's quorum on a Sunday (Aaronic Priesthood Teaching schedule).
export interface TeachingAssignment {
  id: string // `${date}:${quorum}`
  date: string // yyyy-MM-dd
  quorum: 'deacons' | 'teachers' | 'priests'
  teacher?: string
  lesson?: string // e.g. "SFY 4", or a note like "Ward Conference"
}
