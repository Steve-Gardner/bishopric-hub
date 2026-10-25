import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'

// Come, Follow Me weekly lessons. Content stays on churchofjesuschrist.org; we only
// store the week's title and link. Add a new LessonYear each year when the manual is released.
export interface LessonYear {
  year: number
  manual: string
  slug: string
  start: string // ISO date of the Monday the first lesson begins
  titles: string[] // one per week, in order; lesson N links to /{N padded to 2}
}

export interface Lesson {
  year: number
  manual: string
  week: number
  title: string
  starts: Date
  ends: Date
  url: string
}

export const LESSON_YEARS: LessonYear[] = [
  {
    year: 2026,
    manual: 'Come, Follow Me: Old Testament 2026',
    slug: 'come-follow-me-for-home-and-church-old-testament-2026',
    start: '2025-12-29',
    titles: [
      'Introduction to the Old Testament', 'Moses 1; Abraham 3', 'Genesis 1–2; Moses 2–3; Abraham 4–5',
      'Genesis 3–4; Moses 4–5', 'Genesis 5; Moses 6', 'Moses 7', 'Genesis 6–11; Moses 8',
      'Genesis 12–17; Abraham 1–2', 'Genesis 18–23', 'Genesis 24–33', 'Genesis 37–41', 'Genesis 42–50',
      'Exodus 1–6', 'Easter', 'Exodus 7–13', 'Exodus 14–18', 'Exodus 19–20; 24; 31–34',
      'Exodus 35–40; Leviticus 1; 4; 16; 19', 'Numbers 11–14; 20–24; 27',
      'Deuteronomy 6–8; 15; 18; 29–30; 34', 'Joshua 1–8; 23–24', 'Judges 2–4; 6–8; 13–16',
      'Ruth; 1 Samuel 1–7', '1 Samuel 8–10; 13; 15–16', '1 Samuel 17–18; 24–26; 2 Samuel 5–7',
      '2 Samuel 11–12; 1 Kings 3; 6–9; 11', '1 Kings 12–13; 17–22', '2 Kings 2–7', '2 Kings 16–25',
      '2 Chronicles 14–20; 26; 30', 'Ezra 1; 3–7; Nehemiah 2; 4–6; 8', 'Esther',
      'Job 1–3; 12–14; 19; 21–24; 38–40; 42', 'Psalms 1–2; 8; 19–33; 40; 46',
      'Psalms 49–51; 61–66; 69–72; 77–78; 85–86', 'Psalms 102–3; 110; 116–19; 127–28; 135–39; 146–50',
      'Proverbs 1–4; 15–16; 22; 31; Ecclesiastes 1–3; 11–12', 'Isaiah 1–12', 'Isaiah 13–14; 22; 24–30; 35',
      'Isaiah 40–49', 'Isaiah 50–57', 'Isaiah 58–66', 'Jeremiah 1–3; 7; 16–18; 20',
      'Jeremiah 31–33; 36–39; Lamentations 1; 3', 'Ezekiel 1–3; 33–34; 36–37; 47', 'Daniel 1–7',
      'Hosea 1–6; 10–14; Joel', 'Amos; Obadiah; Jonah', 'Micah; Nahum; Habakkuk; Zephaniah',
      'Haggai 1–2; Zechariah 1–4; 7–14', 'Malachi', 'Christmas',
    ],
  },
]

const lessonUrl = (y: LessonYear, week: number) =>
  `https://www.churchofjesuschrist.org/study/manual/${y.slug}/${String(week).padStart(2, '0')}?lang=eng`

/** Lesson for the week containing `date` (weeks run Monday–Sunday), or null if no manual covers it. */
export function lessonFor(date: Date): Lesson | null {
  const day = startOfDay(date)
  for (const y of LESSON_YEARS) {
    const start = parseISO(y.start)
    const idx = Math.floor(differenceInCalendarDays(day, start) / 7)
    if (idx < 0 || idx >= y.titles.length) continue
    const starts = addDays(start, idx * 7)
    return {
      year: y.year, manual: y.manual, week: idx + 1, title: y.titles[idx],
      starts, ends: addDays(starts, 6), url: lessonUrl(y, idx + 1),
    }
  }
  return null
}

export const rangeLabel = (l: Lesson) =>
  `${format(l.starts, 'MMM d')} – ${format(l.ends, l.starts.getMonth() === l.ends.getMonth() ? 'd' : 'MMM d')}`
