import { format, parseISO } from 'date-fns'
import { describeEntry, sortEntries } from './sacrament'
import type { SacramentEntry } from './types'

// The Sacrament Meeting Conducting Script, built from the program on the Sacrament tab plus a few answers
// from the wizard. Anything still unknown is left as [Bracketed] text so it stands out on the page.

export interface HymnAnswer { number: string; title: string }

export const WARD_NAME = 'Ben Lomond 5th'
export const TITLES = ['Brother', 'Sister', 'President'] as const

export interface ScriptAnswers {
  presiding: string // "Bishop Name"; blank until known
  visiting: string // who to recognize, if known ahead of time; otherwise the script leaves a blank to write it in
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
  babies: string[] // the children's names; a blank entry prints as a blank to write in
  titles: Record<string, string> // how to address a person, by entry id: Brother, Sister, President, or '' to say the name as entered
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
const hasTitle = (name: string) => /^(brother|sister|elder|patriarch|president|bishop|dr\.?)\s/i.test(name.trim())

// The title a person is addressed with unless someone chose another: known for youth (from their group) and for
// visitors entered with a title; otherwise undefined, because it can't be worked out from a name.
export function defaultTitle(name: string, group?: 'young-men' | 'young-women'): string | undefined {
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

export interface ScriptInput {
  date: string // the Sunday, yyyy-MM-dd
  answers: ScriptAnswers
  conducting: string // an empty string when no one is set
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
  const title = input.answers.titles[e.id] ?? defaultTitle(name, p?.group)
  if (!title) return name
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
  out.push({
    kind: 'say',
    text:
      `Brothers and Sisters, we welcome you to the sacrament meeting of the ${WARD_NAME} Ward. ` +
      `I am ${input.conducting.trim() || "[Conducting Member's Name]"}, and ${a.presiding.trim() || "[Bishop's Name]"}, ` +
      `who is presiding at today's meeting, has asked me to conduct. We welcome any new members or visitors that are here with us today. ` +
      `Thank you for worshiping our Savior, Jesus Christ with us today.`,
  })
  out.push({
    kind: 'say',
    text: a.visiting.trim() ? `We also recognize ${a.visiting.trim().replace(/\.$/, '')}.` : `We also recognize ${BLANK} from the ${BLANK}.`,
  })
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

  // Speakers and music
  const items = program.filter((e) => ['youth-speaker', 'adult-speaker', 'speaker', 'musical', 'choir'].includes(e.role))
  out.push({ kind: 'heading', text: 'Speakers and Music' })
  if (!items.length) {
    out.push({ kind: 'cue', text: 'No speakers or music on the program yet' })
  } else {
    out.push({ kind: 'cue', text: 'Bishopric member stands up after the sacrament' })
    const isSpeaker = (e: SacramentEntry) => e.role.endsWith('speaker')
    // Split the program into runs of speakers, with each musical number between them.
    const groups: SacramentEntry[][] = []
    for (const e of items) {
      const last = groups.at(-1)
      if (isSpeaker(e) && last && isSpeaker(last[0])) last.push(e)
      else groups.push([e])
    }
    const speakerRun = (g: SacramentEntry[]) => {
      const names = g.map((e) => said(input, e, seen))
      return names.length === 1 ? names[0] : `${names[0]}, followed by ${sentenceList(names.slice(1))}`
    }
    let spoke = false
    let prev = ''
    groups.forEach((g, i) => {
      if (isSpeaker(g[0])) {
        const lead = !spoke
          ? 'First we will hear from '
          : 'After the musical number, we will hear from '
        out.push({ kind: 'say', text: `${lead}${speakerRun(g)}.` })
        spoke = true
        prev = said(input, g[g.length - 1], seen)
      } else {
        const d = describeEntry(g[0])
        const doing = g[0].role === 'choir' ? 'sing' : 'perform'
        const who = g[0].role === 'choir' ? 'the Ward Choir' : g[0].details?.performers?.trim() || '[Performer(s)]'
        const title = g[0].details?.title?.trim() || d.headline
        out.push({ kind: 'say', text: `Following ${i > 0 ? prev : 'the sacrament'}, ${who} will ${doing} ${title}.` })
        prev = 'the musical number'
      }
    })
  }

  // Closing
  out.push({ kind: 'heading', text: 'Closing' })
  const lastItem = items.at(-1)
  const after = lastItem
    ? isSpeakerRole(lastItem.role) ? said(input, lastItem, seen) : 'the musical number'
    : ''
  out.push({
    kind: 'say',
    text: `${after ? `Following ${after}, the` : 'The'} closing song will be ${hymnText(a.closingHymn)}. ${closing ? said(input, closing, seen) : '[Name]'} will offer the closing prayer.`,
  })
  return out
}

const isSpeakerRole = (role: string) => role.endsWith('speaker')

// Starting answers for a Sunday, taken from its program: the first hymn is the opening hymn, the second is
// the sacrament hymn and the third is the closing hymn.
export function defaultAnswers(entries: SacramentEntry[], base: Partial<ScriptAnswers>): ScriptAnswers {
  const hymns = sortEntries(entries).filter((e) => e.role === 'hymn').map((e) => ({ number: e.details?.number ?? '', title: e.details?.title ?? '' }))
  return {
    presiding: '', visiting: '', pianist: '', chorister: '',
    stakeBusiness: false, stakeWho: '', babyBlessings: false, babies: [''], titles: {},
    ...base,
    openingHymn: base.openingHymn ?? hymns[0] ?? emptyHymn(),
    sacramentHymn: base.sacramentHymn ?? hymns[1] ?? emptyHymn(),
    closingHymn: base.closingHymn ?? hymns[2] ?? emptyHymn(),
  }
}
