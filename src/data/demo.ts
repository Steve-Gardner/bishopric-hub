import { addDays, addWeeks, endOfMonth, format, startOfWeek } from 'date-fns'
import { PRESIDENCY } from './people'
import { isGeneralConferenceSunday, SPECIAL_SETTING } from './special'
import {
  appointmentStore, eventStore, fsyStore, gatheringStore, listStore, memberStore,
  councilAssignmentStore, councilStore, gratitudeStore, individualStore, sacramentStore, settingStore, scheduleStore, staffStore, STORES, sundayStore, youthStore,
} from './store'
import type {
  Appointment, BlessingStatus, CalendarEvent, CouncilAssignment, CouncilEntry, FsyRef, Gathering, GratitudeAssignment, Individual, ListItem, Member,
  SacramentEntry, ScheduleRow, StaffName, SundayNote, Youth,
} from './types'

// All demo data uses made-up names and example text. Dates are relative to today so the
// demo always covers the coming month or so.

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const uid = () => crypto.randomUUID()

export async function clearAll() {
  for (const store of Object.values(STORES)) {
    const items = await store.list()
    await Promise.all(items.map((i) => store.remove(i.id)))
  }
}

export async function hasAnyData(): Promise<boolean> {
  for (const store of Object.values(STORES)) if ((await store.list()).length) return true
  return false
}

export async function seedDemo() {
  await clearAll()

  const sun0 = startOfWeek(new Date()) // this week's Sunday (or today if it is Sunday)
  const sun = (n: number) => addDays(sun0, 7 * n)
  const wed = (n: number) => addDays(sun0, 3 + 7 * n)
  const day = (n: number, weekday: number) => addDays(sun0, weekday + 7 * n) // weekday 0 = Sunday

  // ---- Calendar ----
  const ev = (
    id: string, title: string, type: CalendarEvent['type'], date: Date, extra: Partial<CalendarEvent> = {},
  ): CalendarEvent => ({ id, title, type, date: iso(date), ...extra })

  const events: CalendarEvent[] = [
    ev('demo-bishopric', 'Bishopric Meeting', 'meeting', sun(-2), {
      time: '08:15', attendees: [...PRESIDENCY], recurrence: { kind: 'weekly' }, agenda: 'bishopric',
      notes: 'Starts in the bishop\'s office. Bring the sacrament meeting program.',
    }),
    ev('demo-interviews', 'Interviews & Callings', 'interview', sun(-2), {
      time: '11:15', attendees: [...PRESIDENCY], recurrence: { kind: 'weekly' },
    }),
    ev('demo-council-2', 'Ward Council', 'meeting', sun(-4), {
      time: '09:30', attendees: [...PRESIDENCY], recurrence: { kind: 'monthly-nth', nth: 2, weekday: 0 }, agenda: 'council',
    }),
    ev('demo-council-4', 'Ward Council', 'meeting', sun(-4), {
      time: '09:30', attendees: [...PRESIDENCY], recurrence: { kind: 'monthly-nth', nth: 4, weekday: 0 }, agenda: 'council',
    }),
    ev('demo-youth', 'Youth Activity', 'activity', wed(-2), {
      time: '19:00', attendees: ['first-counselor'],
      recurrence: { kind: 'weekly' },
      exceptions: [iso(wed(2))], // one skipped week, to show "delete this one only"
    }),
    ev('demo-temple', 'Youth Temple Trip', 'activity', day(-1, 6), {
      time: '07:00', recurrence: { kind: 'monthly-nth', nth: 5, weekday: 6 }, notes: 'Last Saturday of the month.',
    }),
    ev('demo-choir', 'Ward Choir Practice', 'activity', day(0, 4), {
      time: '19:30', recurrence: { kind: 'weekly', until: iso(day(5, 4)) },
    }),
    ev('demo-tuesday', 'Temple Recommend Interviews', 'interview', day(1, 2), {
      time: '18:00', attendees: ['first-counselor'], notes: 'An off-day event, to show how other days appear.',
    }),
    ev('demo-stake', 'Stake Leaders Meeting', 'meeting', day(1, 4), { time: '19:00' }),
    ev('demo-trunk', 'Ward Activity: Trunk or Treat', 'activity', day(2, 4), { time: '18:30' }),
    ev('demo-primary', 'Primary Program', 'assignment', sun(3), { assignedTo: 'Primary Presidency' }),
    ev('demo-pie', 'Relief Society Pie Night', 'activity', day(3, 4), { time: '18:00' }),
    ev('demo-dinner', 'Ward Dinner', 'activity', day(4, 6), { time: '17:00' }),
    // Youth activities (events with youth groups ticked; they also show on the Youth tab)
    ev('demo-ya-hike', 'Young Men Hike', 'activity', day(-1, 6), { time: '08:00', location: 'Canyon trailhead', youthGroups: ['ym'] }),
    ev('demo-ya-devotional', 'Youth Dinner & Devotional', 'activity', wed(-1), { time: '18:30', location: 'The church', youthGroups: ['all'] }),
    ev('demo-ya-games', 'Youth Game Night', 'activity', wed(0), { time: '18:30', location: 'The church', youthGroups: ['all'] }),
    ev('demo-ya-service', 'Deacons & Teachers Service Project', 'activity', day(0, 6), { time: '09:00', location: 'Ward garden', youthGroups: ['deacons', 'teachers'] }),
    ev('demo-ya-camp', 'Young Women Camp Planning', 'activity', wed(1), { time: '18:30', location: 'The church', youthGroups: ['yw'] }),
    ev('demo-ya-fireside', 'Combined Youth Fireside', 'activity', sun(2), { time: '19:00', location: 'The church', youthGroups: ['all'] }),
  ]
  // End times, to go with the start times above.
  const endTimes: Record<string, string> = {
    'demo-bishopric': '09:15', 'demo-interviews': '12:00', 'demo-council-2': '10:45', 'demo-council-4': '10:45',
    'demo-youth': '20:30', 'demo-temple': '15:00', 'demo-choir': '21:00', 'demo-tuesday': '19:00',
    'demo-stake': '20:30', 'demo-trunk': '20:00', 'demo-pie': '20:00', 'demo-dinner': '19:00',
    'demo-ya-hike': '12:00', 'demo-ya-devotional': '20:00', 'demo-ya-games': '20:00', 'demo-ya-service': '11:00',
    'demo-ya-camp': '20:00', 'demo-ya-fireside': '20:30',
  }
  events.forEach((e) => { if (endTimes[e.id]) e.endTime = endTimes[e.id] })
  events.filter((e) => e.id.startsWith('demo-ya-')).forEach((e) => { e.attendees = [...PRESIDENCY] }) // the bishopric attends youth activities
  await Promise.all(events.map((e) => eventStore.save(e)))

  // Per-event agenda checklists (the Agenda button on an event).
  const meetingKey = (n: number, key: string) => `${key}@${iso(sun(n))}`
  const items = (list: string, rows: [string, boolean?][]): ListItem[] =>
    rows.map(([text, done], order) => ({ id: uid(), list, text, done: done ?? false, order }))
  const lists: ListItem[] = [
    ...items('event:demo-youth', [['Confirm activity plan', true], ['Assign devotional'], ['Snacks']]),
    ...items('event:demo-council-2', [['Ward goals review'], ['Upcoming activities']]),
    // Bishopric Meeting agendas: a separate set of items for each meeting date.
    // This week (n = 0)
    ...items(meetingKey(0, 'agenda:announcements'), [['Youth temple trip sign-up'], ['Ward dinner next month'], ['Primary program practice times']]),
    ...items(meetingKey(0, 'agenda:callings'), [['RS callings'], ['Activity days leader'], ['YW camp director'], ['YM advisors'], ['Sunday School teacher']]),
    ...items(meetingKey(0, 'agenda'), [['Review ward goals'], ['Plan fast Sunday', true], ['Budget check-in'], ['Schedule tithing declaration appointments'], ['Plan next three months of sacrament meetings']]),
    // Next week (n = 1)
    ...items(meetingKey(1, 'agenda:announcements'), [['Remind the ward about the dinner']]),
    ...items(meetingKey(1, 'agenda:callings'), [['Sustain the new activity days leader'], ['Set apart the YW camp director']]),
    ...items(meetingKey(1, 'agenda'), [['Temple goals for next year']]),
    // Last week (n = -1), all finished
    ...items(meetingKey(-1, 'agenda:announcements'), [['Fast offering reminder'], ['Ward temple night']]),
    ...items(meetingKey(-1, 'agenda:callings'), [['Release the former Primary pianist', true], ['Call the new Primary pianist', true]]),
    ...items('set-apart', [['Example Person: Relief Society teacher'], ['Another Person: Primary pianist']]),
    ...items('youth-interviews', [['Example Youth (annual)'], ['Another Youth (temple recommend)']]),
    ...items('followups', [['Follow up on the baptism plan']]),
    ...items('goals', [['Baptismal goal of 2'], ['Youth quarterly temple trip', true], ['Everyone sets a personal temple goal'], ['Every family has a ministering visit monthly'], ['Increase sacrament meeting attendance']]),
    ...items('org:ym', [['Deacons: two new advisors needed'], ['Quorum presidency training'], ['Plan the summer camp']]),
    ...items('org:yw', [['Camp director to be called'], ['Young Women in Excellence planning']]),
    ...items('org:primary', [['Activity days leader needed'], ['Primary program music'], ['Sunbeam teacher'], ['Substitute list']]),
    ...items('org:ss', [['Teacher for the adult class'], ['Youth class needs a second teacher']]),
    ...items('org:rs', [['Visiting teaching coordinator'], ['Service project for the spring'], ['Pie night planning']]),
    ...items('org:eq', [['Emergency preparedness specialist'], ['Quorum service project'], ['Assign ministering brothers']]),
    ...items('org:callings-for', [['The Example family'], ['Sister Sample'], ['Brother Placeholder']]),
  ]
  await Promise.all(lists.map((i) => listStore.save(i)))

  // ---- Ward Council agendas (2nd and 4th Sundays) ----
  const councilSundays = Array.from({ length: 14 }, (_, i) => sun(i - 4))
    .filter((d) => [2, 4].includes(Math.ceil(d.getDate() / 7)))
    .map(iso)
  const todayIso = iso(new Date())
  const upcomingCouncil = councilSundays.filter((d) => d >= todayIso)
  const previousCouncil = councilSundays.filter((d) => d < todayIso).at(-1)
  const [thisCouncil, laterCouncil] = upcomingCouncil

  // Who gives the gratitude and scripture and the roles and responsibilities at each council meeting
  const assignmentNames: [string, string][] = [
    ['Sister Sample', 'Brother Adams'], ['Sister Example', 'Brother Baker'], ['Brother Cole', 'Sister Sample'], ['Sister Example', 'Brother Cole'],
  ]
  const assignments: CouncilAssignment[] = [previousCouncil, ...upcomingCouncil]
    .filter((d): d is string => !!d)
    .slice(0, 4)
    .map((date, i) => ({ id: uid(), date, gratitude: assignmentNames[i][0], roles: assignmentNames[i][1] }))
  await Promise.all(assignments.map((a) => councilAssignmentStore.save(a)))

  const council: CouncilEntry[] = []
  const put = (date: string | undefined, kind: CouncilEntry['kind'], key: string, text: string) => {
    if (date && text) council.push({ id: `${kind}:${date}:${key}`, date, kind, key, text })
  }
  const roles = (date: string | undefined, who: string[]) =>
    ['conducting', 'opening-prayer', 'gratitude', 'roles', 'concluding', 'closing-prayer'].forEach((k, i) => put(date, 'role', k, who[i]))
  roles(thisCouncil, ['', 'Brother Adams', '', '', '', 'Brother Cole']) // Conducting and Concluding follow the Bishop named in Roles
  roles(previousCouncil, ['', 'Brother Cole', '', '', '', 'Brother Baker'])
  roles(laterCouncil, ['', 'Brother Baker', '', '', '', ''])

  const reports: [string, string][] = [
    ['rs', 'Service project planned for the spring. Two sisters could use meals this week. Visiting teaching coordinator needs a helper.'],
    ['yw', 'Two young women are ready for missionary teaching. Camp director still to be called.'],
    ['primary', 'Program practice begins next month. One child will be baptized in the fall.'],
    ['elders', 'Emergency preparedness lesson planned. Check in on a brother recovering from surgery.'],
    ['ss', 'Teaching in the Savior\'s Way follow-up: share what is working.'],
    ['temple-fh', 'Primary research names, youth baptize, adults finish. New converts go to the temple a month after baptism.'],
    ['missionary', 'Walkabout schedule for the month. Anyone who could use a visit from the sisters?'],
    ['stake', 'Pass names along to the stake presidency for visits.'],
    ['ym', 'Deacons quorum needs two new advisors. Summer camp dates are set.'],
    ['activities', 'Fall ward activity is Trunk or Treat. Budget request submitted for the winter dinner.'],
  ]
  for (const [key, text] of reports) {
    put(thisCouncil, 'report', key, text)
    put(previousCouncil, 'report', key, text.split('. ')[0] + '.')
  }
  put(thisCouncil, 'notes', 'extra', 'How do we increase temple attendance? Ideas: temple preparation class with parents joining the youth, scripture study together.\nFlow for the transition from Sunday School to EQ and RS.')
  await Promise.all(council.map((c) => councilStore.save(c)))
  const councilItems: ListItem[] = [
    ...items(`council:items@${thisCouncil}`, [
      ['Member needs: who can we serve?'], ['Missionary concerns and missionary meals'], ['Walkabout schedule'],
      ['Teaching schedule and lessons learned', true], ['Upcoming sacrament meetings'], ['Ward activity dates'], ['Holiday gifts for EQ and RS'], ['Christmas program'],
    ]),
    ...items(`council:items@${previousCouncil}`, [
      ['Member needs: who can we serve?', true], ['Missionary concerns and missionary meals', true], ['Plan the ward rescue effort'],
      ['Youth temple trip dates'], ['Activity committee budget', true],
    ]),
    ...items(`council:items@${laterCouncil}`, [['Review the ward goals'], ['Christmas program']]),
  ]
  await Promise.all(councilItems.map((i) => listStore.save(i)))

  // ---- Gratitude statement assignments and individual and family needs ----
  const gratitude: GratitudeAssignment[] = [
    'Brother Cole', 'Brother Adams', 'Brother Baker', 'Bishop Hale', 'Brother Cole', 'Brother Adams', 'Brother Baker',
  ].map((person, n) => ({ id: uid(), date: iso(sun(n)), person }))
  await Promise.all(gratitude.map((g) => gratitudeStore.save(g)))

  const person = (kind: Individual['kind'], name: string, order: number, notes?: string, hideFromCouncil?: boolean): Individual =>
    ({ id: uid(), kind, name, order, notes, hideFromCouncil })
  const councilNote = (p: Individual, text: string): Individual => ({ ...p, councilNotes: text })
  const people: Individual[] = [
    person('individual', 'Example Person', 0, 'Recently moved in. Follow up about callings and a ministering assignment.'),
    councilNote(person('individual', 'Another Person', 1), 'Ward council offered to bring dinner this week.'),
    person('individual', 'The Sample family', 2, 'Visited last week. Would appreciate a call from the bishop.'),
    councilNote(person('individual', 'Sister Placeholder', 3), 'Relief Society is checking in weekly.'),
    person('individual', 'The Example family', 4, 'Health challenges. Meals scheduled through Relief Society.'),
    person('individual', 'Sister Sample', 5),
    person('individual', 'Brother Placeholder', 6, 'Job loss. Connect with the employment specialist.', true), // bishopric only
    person('individual', 'The Demo family', 7),
    person('individual', 'A new move-in household', 8),
  ]
  await Promise.all(people.map((p) => individualStore.save(p)))

  // ---- Agenda module: Sunday schedule grid ----
  const row = (order: number, start: string, end: string, all: string, weeks: string[], tone: ScheduleRow['tone']): ScheduleRow =>
    ({ id: uid(), order, start, end, all, weeks, tone })
  const none = ['', '', '', '', '']
  const schedule: ScheduleRow[] = [
    row(0, '08:15', '09:15', 'Bishopric Meeting', none, 'none'),
    row(1, '09:30', '10:45', '', ['Org presidents w/ Bishop', 'Ward Council', 'Family Sunday', 'Ward Council', 'As needed'], 'green'),
    row(2, '10:45', '11:15', '', ['Young Women President', 'Ward Youth Council', '', 'Interviews', 'Interviews'], 'yellow'),
    row(3, '11:15', '12:00', 'Interviews, callings, temple recommends', none, 'gray'),
    row(4, '12:00', '14:00', '2-hour block: 1st & 3rd Sunday School; 2nd & 4th YW/YM, RS, Priesthood', none, 'blue'),
    row(5, '14:00', '16:00', '', ['Interviews, finance', 'Interviews, finance', 'Family Sunday', 'Interviews, finance', 'Interviews, finance'], 'none'),
  ]
  await Promise.all(schedule.map((r) => scheduleStore.save(r)))

  // ---- Interviews for the coming Sunday ----
  const leaderRoles: Record<string, Appointment['leaderRole']> = { 'Bishop Hale': 'bishop', 'Brother Adams': 'first-counselor', 'Brother Baker': 'second-counselor' }
  const appt = (leader: string, time: string, name: string, purpose: string, week = 1): Appointment =>
    ({ id: uid(), date: iso(sun(week)), leader, leaderRole: leaderRoles[leader], time, name, purpose })
  const appts: Appointment[] = [
    appt('Bishop Hale', '10:40', 'Alex Rivera', 'Tithing declaration'),
    appt('Bishop Hale', '10:50', 'Jordan Lee', 'Tithing declaration'),
    appt('Bishop Hale', '11:00', 'Casey Morgan', 'Temple recommend'),
    appt('Brother Adams', '11:10', 'Taylor Brooks', 'Youth interview'),
    appt('Brother Adams', '11:20', 'Riley Chen', 'Calling'),
    appt('Brother Baker', '11:10', 'Sam Patel', 'Setting apart'),
    // This Sunday
    appt('Bishop Hale', '10:45', 'Pat Kim', 'Tithing declaration', 0),
    appt('Bishop Hale', '11:00', 'Chris Alvarez', 'Temple recommend', 0),
    appt('Brother Adams', '11:15', 'Drew Nguyen', 'Youth interview', 0),
    appt('Brother Baker', '11:15', 'Dana Reyes', 'Calling', 0),
    appt('Brother Baker', '11:30', 'Lee Foster', 'Setting apart', 0),
  ]
  await Promise.all(appts.map((a) => appointmentStore.save(a)))

  // ---- Ward: Gathering One by One in Christ ----
  const gather: Gathering[] = [
    { id: uid(), name: 'Example Person', ordinance: 'Baptism', plan: 'Invite to the ward activity, have the missionaries visit' },
    { id: uid(), name: 'Another Person', ordinance: 'Temple endowment', plan: 'Meet with the bishop; family history night' },
    { id: uid(), name: 'The Sample family', ordinance: 'Sealing', plan: 'Temple preparation class; invite to the youth temple trip' },
    { id: uid(), name: 'Sister Placeholder', ordinance: 'Priesthood ordination (son)', plan: 'Visit with the elders quorum president' },
  ]
  await Promise.all(gather.map((g) => gatheringStore.save(g)))

  // ---- Special sacrament meeting dates (made up) ----
  const special: Record<string, string> = {
    [SPECIAL_SETTING.wardConference]: iso(sun(3)),
    [SPECIAL_SETTING.stakeConference1]: iso(sun(5)),
    [SPECIAL_SETTING.stakeConference2]: iso(sun(26)),
    [SPECIAL_SETTING.easter]: iso(sun(24)),
    [SPECIAL_SETTING.primaryProgram]: iso(sun(7)),
    [SPECIAL_SETTING.christmas]: iso(sun(10)),
  }
  await Promise.all(Object.entries(special).map(([id, value]) => settingStore.save({ id, value })))

  // ---- Roles: who holds each one. A few Sundays with extra notes (the rest follows the rules) ----
  const staff: StaffName[] = [
    { id: 'bishop', name: 'Bishop Hale' }, { id: 'first-counselor', name: 'Brother Adams' }, { id: 'second-counselor', name: 'Brother Baker' },
    { id: 'ward-clerk', name: 'Brother Clark' }, { id: 'executive-secretary', name: 'Brother Lowe' }, { id: 'high-councilor', name: 'Brother Moss' },
  ]
  await Promise.all(staff.map((p) => staffStore.save(p)))
  // Sample notes go on 3rd and 4th Sundays so they don't replace the Fast Sunday the rules already provide.
  const extraNotes = ['High Council speaker', 'Primary Program', 'Youth fireside', 'Stake Conference', 'Ward Conference']
  const plainSundays = Array.from({ length: 24 }, (_, i) => sun(i)).filter((d) => [3, 4].includes(Math.ceil(d.getDate() / 7)))
  const notes: SundayNote[] = extraNotes.map((note, i) => ({ id: iso(plainSundays[i]), date: iso(plainSundays[i]), note }))
  await Promise.all(notes.map((n) => sundayStore.save(n)))

  // ---- Youth roster, with blessing status ----
  const youth = (name: string, group: Youth['group'], status: BlessingStatus, appt?: Date): Youth =>
    ({ id: uid(), name, group, status, appointmentDate: appt ? iso(appt) : undefined })
  const youthRows: Youth[] = [
    youth('Taylor Brooks', 'young-men', 'received'),
    youth('Riley Chen', 'young-women', 'scheduled', addWeeks(new Date(), 3)),
    youth('Morgan Ellis', 'young-women', 'not-yet'),
    youth('Drew Nguyen', 'young-men', 'not-yet'),
    youth('Avery Stone', 'young-women', 'scheduled', addDays(endOfMonth(new Date()), 5)),
    youth('Jamie Cruz', 'young-men', 'received'),
    youth('Quinn Hayes', 'young-men', 'not-yet'),
    youth('Sage Patel', 'young-women', 'received'),
    youth('Elliot Ward', 'young-men', 'scheduled', addWeeks(new Date(), 2)),
    youth('Hannah Lopez', 'young-women', 'not-yet'),
    youth('Wyatt Moore', 'young-men', 'not-yet'),
    youth('Lily Foster', 'young-women', 'scheduled', addWeeks(new Date(), 6)),
  ]
  await Promise.all(youthRows.map((y) => youthStore.save(y)))

  // ---- Sacrament: roster + recent log ----
  const names = ['Alex Rivera', 'Jordan Lee', 'Casey Morgan', 'Sam Patel', 'Pat Kim', 'Chris Alvarez', 'Dana Reyes', 'Lee Foster', 'Robin Hayes', 'Kelly Owens']
  const members: Member[] = names.map((name) => ({ id: uid(), name }))
  await Promise.all(members.map((m) => memberStore.save(m)))
  // Recent programs, and this week and next (some already filled in, one still empty). Entries are listed in
  // program order; `order` is their place in it.
  const log: SacramentEntry[] = []
  const counters = new Map<number, number>()
  const add = (n: number, role: SacramentEntry['role'], person?: number, details?: Record<string, string>, youthIdx?: number) => {
    if (isGeneralConferenceSunday(iso(sun(n)))) return // nothing is scheduled on General Conference Sunday
    const order = counters.get(n) ?? 0
    counters.set(n, order + 1)
    log.push({ id: uid(), date: iso(sun(n)), role, order, memberId: person === undefined ? undefined : members[person].id, youthId: youthIdx === undefined ? undefined : youthRows[youthIdx].id, details })
  }
  // Three weeks ago
  add(-3, 'hymn', undefined, { number: '2', title: 'The Spirit of God' }); add(-3, 'invocation', 2)
  add(-3, 'youth-speaker', undefined, { topic: 'Gratitude' }, 0); add(-3, 'adult-speaker', 0, { topic: 'Ministering' }); add(-3, 'adult-speaker', 1)
  add(-3, 'benediction', 3)
  // Two weeks ago
  add(-2, 'invocation', 6); add(-2, 'hymn', undefined, { number: '85', title: 'How Firm a Foundation' })
  add(-2, 'adult-speaker', 4, { topic: 'The temple' }); add(-2, 'musical', undefined, { performers: 'The Sample family', title: 'Come, Thou Fount' })
  add(-2, 'adult-speaker', 5); add(-2, 'benediction', 0)
  // Last week
  add(-1, 'invocation', 8); add(-1, 'youth-speaker', undefined, { topic: 'Missionary work' }, 5); add(-1, 'adult-speaker', 1, { topic: 'Family history' })
  add(-1, 'choir', undefined, { title: 'Joy to the World', director: 'Sister Sample' }); add(-1, 'benediction', undefined, undefined, 1)
  // This week: mostly planned
  add(0, 'hymn', undefined, { number: '19', title: 'We Thank Thee, O God, for a Prophet' }); add(0, 'invocation', 9)
  add(0, 'youth-speaker', undefined, { topic: 'Faith in Jesus Christ' }, 2); add(0, 'adult-speaker', 3, { topic: 'Service' }); add(0, 'adult-speaker', 6, { topic: 'Gratitude' })
  add(0, 'musical', undefined, { performers: 'Alex and Jordan', title: 'Be Still, My Soul' }); add(0, 'benediction', 5)
  // Next Sunday
  add(1, 'hymn', undefined, { number: '85', title: 'How Firm a Foundation' }); add(1, 'invocation', 4)
  add(1, 'youth-speaker', undefined, { topic: 'Service' }, 3); add(1, 'adult-speaker', 0, { topic: 'Following the Savior' }); add(1, 'adult-speaker', 7, { topic: 'The Book of Mormon' })
  add(1, 'choir', undefined, { title: 'Come, Ye Thankful People, Come', director: 'Sister Sample' }); add(1, 'benediction', 1)
  await Promise.all(log.map((e) => sacramentStore.save(e)))


  // ---- FSY: clearly example text ----
  const ref = (category: string, label: string, value: string): FsyRef => ({ id: uid(), category, label, value })
  const refs: FsyRef[] = [
    ref('Dates & registration', 'Conference dates', 'Example: add your session dates here'),
    ref('Forms', 'Medical form reminder', 'Example: due two weeks before the conference'),
    ref('Packing list', 'Bring', 'Sleeping bag\nWater bottle\nModest clothing'),
    ref('Contacts', 'Ward FSY coordinator', 'Example Coordinator, 555-0100'),
    ref('Links', 'Example link', 'https://example.com'),
  ]
  await Promise.all(refs.map((r) => fsyStore.save(r)))
}
