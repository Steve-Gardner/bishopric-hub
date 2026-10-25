import { addDays, endOfMonth, format, getDay, startOfDay } from 'date-fns'

// Sunday lessons for Aaronic Priesthood quorums and Young Women classes (For the Strength of Youth
// curriculum, started Sept 2026). We store only the month's chapter title and the links, no lesson text.
// Add a month to MONTHS as it's confirmed; months not listed still link to that month's contents page.
export interface YouthMonth {
  chapter: string
  second: string // what the 2nd Sunday covers
  third: string // what the 3rd Sunday covers
}

const MONTHS: Record<string, YouthMonth> = {
  '2026-09': {
    chapter: 'You Are Blessed by Priesthood Keys and Authority',
    second: 'The restoration of the priesthood',
    third: 'Priesthood keys',
  },
  '2026-10': {
    chapter: 'Your Body Is Sacred',
    second: 'The Word of Wisdom',
    third: 'The law of chastity',
  },
}

export interface YouthLink {
  key: 'first' | 'second' | 'third' | 'fourthYW' | 'fourthAP'
  label: string
  detail: string
  url: string
}

export interface YouthLessons {
  sunday: Date
  monthLabel: string
  chapter: string | null
  monthUrl: string
  links: YouthLink[]
  /** Which links apply to the Sunday (the last Sunday has both a YW and an AP lesson). */
  current: YouthLink['key'][]
}

const base = 'https://www.churchofjesuschrist.org/study/ftsoy'

/** The Sunday on or after `date`. */
export const sundayOnOrAfter = (date: Date) => {
  const d = startOfDay(date)
  return addDays(d, (7 - getDay(d)) % 7)
}

export function youthLessonsFor(date: Date): YouthLessons | null {
  const sunday = sundayOnOrAfter(date)
  // The curriculum began Sunday, Sept 6, 2026.
  if (sunday < new Date(2026, 8, 6)) return null

  const ym = format(sunday, 'yyyy-MM')
  const month = MONTHS[ym]
  const lessonBase = `${base}/${format(sunday, 'yyyy')}/${format(sunday, 'MM')}/fsy-lessons`
  const link = (path: string) => `${lessonBase}/${path}?lang=eng`
  const ordinal = Math.ceil(sunday.getDate() / 7)
  const isLast = addDays(sunday, 7) > endOfMonth(sunday)

  const links: YouthLink[] = [
    { key: 'first', label: 'Fast Sunday', detail: 'Study the chapter from the FSY guide', url: link('01-fast-sunday') },
    { key: 'second', label: 'Second Sunday', detail: month?.second ?? 'Learn more', url: link('02-second-sunday') },
    { key: 'third', label: 'Third Sunday', detail: month?.third ?? 'Learn more', url: link('03-third-sunday') },
    { key: 'fourthYW', label: 'Last Sunday: Young Women', detail: 'Becoming a covenant daughter of God', url: link('04a-fourth-sunday') },
    { key: 'fourthAP', label: 'Last Sunday: Aaronic Priesthood', detail: 'Becoming a covenant son of God', url: link('04b-fourth-sunday') },
  ]

  // Weeks 2 and 3 are combined in a four-Sunday month; a fifth Sunday has no lesson of its own, so it
  // shows the third. Confirm against the Church's page if a month looks off.
  const current: YouthLink['key'][] = isLast
    ? ['fourthYW', 'fourthAP']
    : [ordinal === 1 ? 'first' : ordinal === 2 ? 'second' : 'third']

  return {
    sunday,
    monthLabel: format(sunday, 'MMMM yyyy'),
    chapter: month?.chapter ?? null,
    monthUrl: `${base}/${format(sunday, 'yyyy')}/${format(sunday, 'MM')}?lang=eng`,
    links,
    current,
  }
}
