import { format, parseISO } from 'date-fns'
import { findByName } from './nicknames'
import { sortEntries } from './sacrament'
import type { SacramentEntry } from './types'

// The Sacrament Meeting Conducting Script, built from the program on the Sacrament tab plus a few answers
// from the wizard. Anything still unknown is left as [Bracketed] text so it stands out on the page.

export interface HymnAnswer { number: string; title: string }

export const WARD_NAME = 'Ben Lomond 5th'
// When the testimonies are expected to end on a fast Sunday. It changes once a year, with the meeting time.
export const FAST_SUNDAY_END = '12:50'
export const TITLES = ['Brother', 'Sister', 'President'] as const
// Offered to speakers only: they are introduced as "our youth speaker, Jamie Cruz" instead of with a title.
export const YOUTH_SPEAKER = 'Youth Speaker'
// Also for speakers: "Brother John Smith from the High Council", then "Brother Smith". They are also recognized in the welcome.
export const HIGH_COUNCILOR = 'High Councilor'

export interface ScriptAnswers {
  presiding: string // "Bishop Name"; blank until known
  visitors: Visitor[] // visiting leaders to recognize, if known ahead of time; the script always leaves a blank to write one in
  pianist: string
  chorister: string
  announcements?: string // one per line; absent means "follow the Bishopric Agenda"
  openingHymn: HymnAnswer
  sacramentHymn: HymnAnswer
  closingHymn: HymnAnswer
  releases?: string // one per line: "Name as Calling"; absent means "follow the Bishopric Agenda"
  sustainings?: string // same
  stakeBusiness: boolean
  stakeWho: string // who has the stake business, if known
  babyBlessings: boolean
  fastSunday?: boolean // overrides what the Conducting Schedule says about this Sunday
  bishopAbsent?: boolean // set when a counselor conducts: the first counselor then presides
  firstAbsent?: boolean // ...and when he is away too, the second counselor
  secondAbsent?: boolean
  dyslexic?: boolean // print in the dyslexia-friendly font; absent means on when the bishop conducts
  babies: string[] // the children's names; a blank entry prints as a blank to write in
  titles: Record<string, string> // how to address a person, by entry id: Brother, Sister, President, or '' to say the name as entered
}

// The stake leaders who visit regularly, with the position each one holds. Anyone else is entered as "Other".
export const STAKE_LEADERS = [
  { key: 'godfrey', name: 'Dave Godfrey', position: 'high' },
  { key: 'dalton', name: 'President Dalton', position: 'sp' },
  { key: 'barker', name: 'President Barker', position: 'c1' },
  { key: 'benson', name: 'President Benson', position: 'c2' },
] as const

export const POSITIONS = {
  high: 'High Council',
  sp: 'Stake President',
  c1: '1st Counselor in the Stake Presidency',
  c2: '2nd Counselor in the Stake Presidency',
} as const

export interface Visitor {
  who: string // a STAKE_LEADERS key, or 'other' to type a name
  name: string // used when who is 'other'
  position: string // a POSITIONS key, 'other' to type one, or '' for none
  positionText: string
  presiding?: boolean // only for 'other': they preside, so the welcome names them instead of the bishop
}

export const emptyVisitor = (): Visitor => ({ who: '', name: '', position: '', positionText: '' })

// How one visiting leader is introduced, or '' when nobody has been entered for the row.
function visitorText(v: Visitor): string {
  const leader = STAKE_LEADERS.find((l) => l.key === v.who)
  const name = leader ? leader.name : v.name.trim()
  if (!name) return ''
  switch (v.position) {
    case 'high': return `${name} from the High Council`
    case 'sp': return `${name}, our Stake President`
    case 'c1': return `${name}, First Counselor in the Stake Presidency`
    case 'c2': return `${name}, Second Counselor in the Stake Presidency`
    case 'other': return v.positionText.trim() ? `${name}, ${v.positionText.trim()}` : name
    default: return name
  }
}

// Seniority among visiting leaders: Stake President, 1st and 2nd Counselor, high councilors (Dave Godfrey first),
// then anyone else, in the order entered.
const rankOf = (v: Visitor): number => {
  const pos = STAKE_LEADERS.find((l) => l.key === v.who)?.position ?? v.position
  return pos === 'sp' ? 1 : pos === 'c1' ? 2 : pos === 'c2' ? 3 : pos === 'high' ? (v.who === 'godfrey' ? 4 : 5) : 6
}

// Who presides, and who is recognized after that. Someone marked presiding always presides; otherwise the most
// senior member of the stake presidency does. High councilors and everyone else are only recognized.
export function sortVisitors(visitors: Visitor[]): { presider?: Visitor; recognized: Visitor[] } {
  const entered = visitors.filter((v) => visitorText(v))
  const marked = entered.find((v) => v.presiding)
  const senior = [...entered].sort((a, b) => rankOf(a) - rankOf(b)).find((v) => rankOf(v) <= 3)
  const presider = marked ?? senior
  const recognized = entered.filter((v) => v !== presider).map((v, i) => ({ v, i })).sort((a, b) => rankOf(a.v) - rankOf(b.v) || a.i - b.i).map((x) => x.v)
  return { presider, recognized }
}

export const emptyHymn = (): HymnAnswer => ({ number: '', title: '' })

export type Block =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'say'; text: string }
  | { kind: 'cue'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'sub'; text: string }

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)
const hymnText = (h: HymnAnswer) => {
  const num = h.number.trim().replace(/^#/, '')
  const parts = [num ? `hymn number #${num}` : '', h.title.trim()].filter(Boolean)
  return parts.length ? parts.join(', ') : 'hymn number [#], [Hymn Title]'
}
const lastName = (name: string) => name.trim().split(/\s+/).at(-1) ?? ''

const BLANK = '____________________'
const stripTitle = (name: string) => name.trim().replace(/^(brother|sister|elder|patriarch|president|bishop|dr\.?)\s+/i, '')
const hasTitle = (name: string) => /^(brother|sister|elder|patriarch|president|bishop|dr\.?)\s/i.test(name.trim())

// The title a person is addressed with unless someone chose another: known for youth (from their group) and for
// visitors entered with a title; otherwise undefined, because it can't be worked out from a name.
export function defaultTitle(name: string, group?: 'young-men' | 'young-women', affiliation?: string): string | undefined {
  if (affiliation && /high/i.test(affiliation)) return HIGH_COUNCILOR
  if (group) return group === 'young-men' ? 'Brother' : 'Sister'
  return hasTitle(name) ? '' : undefined
}

// "Pat Lee as Primary Teacher" -> "Pat Lee". One line can name more than one person ("Pat and Chris Lee as ...").
const nameOf = (line: string) => line.split(/\s+as\s+/i)[0].trim() || 'this individual'
const isOne = (items: string[]) => items.length === 1 && !/,|\band\b|&/i.test(nameOf(items[0]))

const sentenceList = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

export interface ProgramPerson {
  entry: SacramentEntry
  name: string
  group?: 'young-men' | 'young-women'
}

export type ConductorRole = 'bishop' | 'first' | 'second' | 'other'

export interface ScriptInput {
  date: string // the Sunday, yyyy-MM-dd
  answers: ScriptAnswers
  conducting: string // an empty string when no one is set
  conductorRole: ConductorRole
  fastSunday: boolean // a fast and testimony meeting: no speakers or music, just testimonies
  counselors: { first: string; second: string } // their names from Roles; '' until one has been entered
  entries: SacramentEntry[]
  people: Record<string, ProgramPerson> // by entry id, for prayers and speakers
}

// How a person in the program is said aloud.
// The first time someone is named, a chosen title goes with their full name ("Sister Jamie Cruz"); after that
// it is the title and last name ("Sister Cruz"). `seen` holds who has already been named.
function said(input: ScriptInput, e: SacramentEntry, seen: Set<string>): string {
  const p = input.people[e.id]
  const name = (p?.name || e.details?.name || '').trim()
  if (!name) return '[Name]'
  const title = input.answers.titles[e.id] ?? defaultTitle(name, p?.group, e.details?.affiliation)
  if (!title) return name
  if (title === HIGH_COUNCILOR) {
    const bare = stripTitle(name)
    const again = seen.has(name.toLowerCase())
    seen.add(name.toLowerCase())
    return again ? `Brother ${lastName(bare)}` : `Brother ${bare} from the High Council`
  }
  if (title === YOUTH_SPEAKER) {
    const again = seen.has(name.toLowerCase())
    seen.add(name.toLowerCase())
    return again ? name : `our youth speaker, ${name}`
  }
  const first = !seen.has(name.toLowerCase())
  seen.add(name.toLowerCase())
  return first ? `${title} ${name}` : `${title} ${lastName(name)}`
}

export function buildScript(input: ScriptInput): Block[] {
  const a = input.answers
  const out: Block[] = []
  const seen = new Set<string>()
  const program = sortEntries(input.entries)
  const opening = program.find((e) => e.role === 'invocation')
  const closing = program.find((e) => e.role === 'benediction')

  out.push({ kind: 'title', text: 'Sacrament Meeting Conducting Script' })
  out.push({ kind: 'sub', text: `${WARD_NAME} Ward · ${format(parseISO(input.date), 'EEEE, MMMM d, yyyy')}` })

  // Welcome
  out.push({ kind: 'heading', text: 'Welcome' })
  const bishop = a.presiding.trim() || "[Bishop's Name]"
  // A speaker marked High Councilor is also recognized in the welcome, unless already entered as a visiting leader.
  const sameName = (x: string, y: string) => x.toLowerCase() === y.toLowerCase() || !!findByName([{ name: x }], y)
  const entered = a.visitors.map((v) => STAKE_LEADERS.find((l) => l.key === v.who)?.name ?? v.name)
  const councilors: Visitor[] = []
  for (const e of program) {
    const p = input.people[e.id]
    const name = stripTitle((p?.name || e.details?.name || '').trim())
    if (!name || (a.titles[e.id] ?? defaultTitle(name, p?.group, e.details?.affiliation)) !== HIGH_COUNCILOR) continue
    if (entered.some((x) => sameName(x, name))) continue
    entered.push(name)
    const leader = STAKE_LEADERS.find((l) => l.position === 'high' && sameName(l.name, name))
    councilors.push({ who: leader ? leader.key : 'other', name, position: 'high', positionText: '' })
  }
  const { presider, recognized } = sortVisitors([...a.visitors, ...councilors])
  const presides = presider ? visitorText(presider) : ''
  const role = input.conductorRole
  const conductor = role === 'bishop' ? bishop : input.conducting.trim() || "[Conducting Member's Name]"
  const first = input.counselors.first || "[First Counselor's Name]"
  const second = input.counselors.second || "[Second Counselor's Name]"
  // With no visiting presider, the bishop presides. When he is away it is the first counselor, and when both are
  // away the second. (A bishop who is conducting is of course there.)
  const bishopOut = role !== 'bishop' && !!a.bishopAbsent
  const home: { role: ConductorRole; desc: string } | null =
    !bishopOut ? { role: 'bishop', desc: bishop }
    : !a.firstAbsent ? { role: 'first', desc: `${first}, First Counselor in the Bishopric` }
    : !a.secondAbsent ? { role: 'second', desc: `${second}, Second Counselor in the Bishopric` }
    : null
  const comma = (d: string) => (d.includes(',') ? ',' : '')
  const asked = `I am ${conductor}, and I have been asked to conduct.`
  let intro: string
  if (presides) intro = `${role === 'bishop' ? `I am ${bishop}.` : asked} We recognize ${presides}${comma(presides)} who presides today.`
  else if (!home) intro = asked
  else if (home.role === role) intro = `I am ${conductor}.`
  else if (home.role === 'bishop') intro = `I am ${conductor}, and ${bishop}, who presides today, has asked me to conduct.`
  else intro = `${asked} ${home.desc}, presides today.`
  out.push({
    kind: 'say',
    text:
      `Brothers and Sisters, we welcome you to the sacrament meeting of the ${WARD_NAME} Ward. ` +
      `${intro} We welcome any new members or visitors that are here with us today. ` +
      `Thank you for worshiping our Savior, Jesus Christ with us today.`,
  })

  // Members of the High Council are named together: "A and B from the High Council".
  const nameOfV = (v: Visitor) => STAKE_LEADERS.find((l) => l.key === v.who)?.name ?? v.name.trim()
  const joinAnd = (xs: string[]) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
  const parts: string[] = []
  const councilorNames: string[] = []
  let councilAt = -1
  for (const v of recognized) {
    if (v.position === 'high') {
      if (councilAt < 0) { councilAt = parts.length; parts.push('') }
      councilorNames.push(nameOfV(v))
    } else parts.push(visitorText(v))
  }
  if (councilAt >= 0) parts[councilAt] = `${joinAnd(councilorNames)} from the High Council`
  const known = parts.filter(Boolean)
  const list = known.length <= 2 ? known.join(' and ') : `${known.slice(0, -1).join('; ')}; and ${known.at(-1)}`
  // With no one to name, a blank is left to write in whoever turns up.
  const onStand = recognized.length === 1 ? 'who is on the stand today' : 'who are on the stand today'
  out.push({ kind: 'say', text: known.length ? `We also recognize ${list}, ${onStand}.` : `We also recognize ${BLANK} from the ${BLANK}.` })
  const pianist = a.pianist.trim()
  const leader = a.chorister.trim()
  if (pianist || leader) {
    const prelude = pianist ? `We appreciate the prelude music provided by ${pianist}` : ''
    const leads = leader ? `${prelude ? 'and also recognize' : 'We also recognize'} ${leader} who is leading our music today` : ''
    out.push({ kind: 'say', text: [prelude, leads].filter(Boolean).join(', ') + '.' })
  }

  // Opening hymn and prayer
  out.push({ kind: 'heading', text: 'Opening Hymn and Prayer' })
  out.push({
    kind: 'say',
    text: `We will begin our meeting by singing ${hymnText(a.openingHymn)}. Following the hymn, ${opening ? said(input, opening, seen) : '[Name]'} will offer our opening prayer.`,
  })
  out.push({ kind: 'cue', text: 'Bishopric member stands up after the prayer' })
  out.push({ kind: 'say', text: `Thank you, ${opening ? said(input, opening, seen) : '[Name]'}.` })

  // Brief announcements
  const announcements = lines(a.announcements ?? '')
  out.push({ kind: 'heading', text: 'Brief Announcements' })
  if (announcements.length) {
    const howMany = announcements.length === 1 ? 'one brief announcement' : announcements.length === 2 ? 'a couple of brief announcements' : 'a few brief announcements'
    out.push({ kind: 'say', text: `We have ${howMany} today.` })
    out.push({ kind: 'list', items: announcements })
  } else {
    out.push({ kind: 'say', text: "We don't have any announcements today." })
  }

  // Ward business
  const releases = lines(a.releases ?? '')
  const sustainings = lines(a.sustainings ?? '')
  if (releases.length || sustainings.length) {
    out.push({ kind: 'heading', text: 'Ward Business' })
    if (releases.length) {
      const one = isOne(releases)
      out.push({ kind: 'say', text: one ? 'The following individual has been released:' : 'The following individuals have been released:' })
      out.push({ kind: 'list', items: releases })
      // A single person is named instead of saying his or her, so no one's gender has to be asked.
      out.push({ kind: 'say', text: `Those who wish to express their thanks for ${one ? `${nameOf(releases[0])}'s` : 'their'} service, please manifest it by the uplifted hand.` })
    }
    if (sustainings.length) {
      const one = isOne(sustainings)
      out.push({
        kind: 'say',
        text: one ? 'Would the following individual please stand. We have extended a calling to:' : 'Would the following individuals please stand when their names are called. We have extended callings to:',
      })
      out.push({ kind: 'list', items: sustainings })
      out.push({ kind: 'say', text: `Those in favor of sustaining ${one ? nameOf(sustainings[0]) : 'them'} may show it by the uplifted hand (Pause). Those opposed, if any, may do so (Pause).` })
    }
  }

  // Sacrament
  out.push({ kind: 'heading', text: 'Sacrament Hymn & Sacrament' })
  const stake = a.stakeBusiness
  if (stake) out.push({ kind: 'say', text: `We will now turn the time over to ${a.stakeWho.trim() || BLANK} for Stake Business.` })
  out.push({
    kind: 'say',
    text: `${stake ? 'Following the stake business, we' : 'We'} will prepare to remember the Savior through the sacrament by singing ${hymnText(a.sacramentHymn)}.`,
  })
  out.push({ kind: 'sub', text: 'Blessing on the bread' })
  out.push({
    kind: 'say',
    text:
      'O God, the Eternal Father, we ask thee in the name of thy Son, Jesus Christ, to bless and sanctify this bread to the souls of all those who partake of it; that they may eat in remembrance of the body of thy Son, and witness unto thee, O God, the Eternal Father, that they are willing to take upon them the name of thy Son, and always remember him and keep his commandments which he has given them, that they may always have his Spirit to be with them. Amen.',
  })
  out.push({ kind: 'sub', text: 'Blessing on the water' })
  out.push({
    kind: 'say',
    text:
      'O God, the Eternal Father, we ask thee in the name of thy Son, Jesus Christ, to bless and sanctify this water to the souls of all those who drink of it, that they may do it in remembrance of the blood of thy Son, which was shed for them; that they may witness unto thee, O God, the Eternal Father, that they do always remember him, that they may have his Spirit to be with them. Amen.',
  })

  // Baby blessings (draft wording)
  if (a.babyBlessings) {
    const babies = a.babies.length ? a.babies.map((n) => n.trim() || BLANK) : [BLANK]
    out.push({ kind: 'heading', text: 'Baby Blessings' })
    out.push({ kind: 'cue', text: 'Bishopric member stands up after the sacrament' })
    out.push({ kind: 'say', text: `We will now have the privilege of hearing the baby ${babies.length > 1 ? 'blessings' : 'blessing'} for ${sentenceList(babies)}.` })
  }

  // Speakers and music: or, on a fast Sunday, testimonies.
  if (input.fastSunday) {
    out.push({ kind: 'heading', text: 'Testimonies' })
    out.push({ kind: 'cue', text: 'Bishopric member shares testimony' })
    out.push({ kind: 'say', text: `Brothers and Sisters, the time is now yours to share your testimonies of the Savior and His gospel. We will go until about ${FAST_SUNDAY_END}.` })
    out.push({ kind: 'cue', text: 'Bishopric member sits down' })
  } else {
    const items = program.filter((e) => ['youth-speaker', 'adult-speaker', 'speaker', 'musical', 'choir'].includes(e.role))
    out.push({ kind: 'heading', text: 'Speakers and Music' })
    if (!items.length) {
      out.push({ kind: 'cue', text: 'No speakers or music on the program yet' })
    } else {
      out.push({ kind: 'cue', text: 'Bishopric member stands up after the sacrament' })
      const speakers = items.filter((e) => isSpeakerRole(e.role)).length
      items.forEach((e, i) => {
        const thanks = i === 0 ? 'Thank you. ' : ''
        const prev = items[i - 1]
        let line: string
        if (!isSpeakerRole(e.role)) {
          const title = e.details?.title?.trim()
          const who = e.role === 'choir' ? 'our Ward Choir' : e.details?.performers?.trim() || '[Performer(s)]'
          line = `We will ${i === 0 ? 'now' : 'then'} have a special musical number${title ? `, \u201c${title}\u201d,` : ''} performed by ${who}.`
        } else if (i === 0) {
          line = `We will now hear from ${said(input, e, seen)}.`
        } else if (speakers >= 2 && i === items.length - 1) {
          line = `Our concluding speaker will be ${said(input, e, seen)}.`
        } else if (isSpeakerRole(prev.role)) {
          // The previous speaker has just been named, so this is the second mention of them.
          const before = said(input, prev, seen)
          line = `Following ${before}, we'll hear from ${said(input, e, seen)}.`
        } else {
          line = `Following the musical number, we'll hear from ${said(input, e, seen)}.`
        }
        out.push({ kind: 'say', text: thanks + line })
      })
    }
  }

  // Closing
  out.push({ kind: 'heading', text: 'Closing' })
  const hymnShort = (h: HymnAnswer) => {
    const num = h.number.trim().replace(/^#/, '')
    return [num ? `#${num}` : '#[#]', h.title.trim() || '[Hymn Title]'].join(', ')
  }
  out.push({
    kind: 'say',
    text: `${input.fastSunday ? 'Brothers and Sisters, thank you for your testimonies today. ' : ''}Our closing hymn will be ${hymnShort(a.closingHymn)}. ${closing ? said(input, closing, seen) : '[Name]'} will offer the closing prayer.`,
  })
  return out
}

const isSpeakerRole = (role: string) => role.endsWith('speaker')

// Starting answers for a Sunday, taken from its program: the first hymn is the opening hymn, the second is
// the sacrament hymn and the third is the closing hymn.
export function defaultAnswers(entries: SacramentEntry[], base: Partial<ScriptAnswers>): ScriptAnswers {
  const hymns = sortEntries(entries).filter((e) => e.role === 'hymn').map((e) => ({ number: e.details?.number ?? '', title: e.details?.title ?? '' }))
  return {
    presiding: '', visitors: [], pianist: '', chorister: '',
    stakeBusiness: false, stakeWho: '', babyBlessings: false, babies: [''], titles: {},
    ...base,
    openingHymn: base.openingHymn ?? hymns[0] ?? emptyHymn(),
    sacramentHymn: base.sacramentHymn ?? hymns[1] ?? emptyHymn(),
    closingHymn: base.closingHymn ?? hymns[2] ?? emptyHymn(),
  }
}
