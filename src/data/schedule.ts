import type { ScheduleRow } from './types'

export const FAMILY_SUNDAY_SETTING = 'familySundayWeek' // value '1'-'5', or '0' for none
export const DEFAULT_FAMILY_SUNDAY_WEEK = 3

// The Family Sunday week: one shared choice, and a choice for each year that has its own schedule.
export interface FamilyWeeks { base: number; byYear: Record<number, number> }
export const familySettingId = (year: number) => `${FAMILY_SUNDAY_SETTING}@${year}`

// The schedule rows that apply to a year: the ones planned for that year, or, when none are, the shared ones.
export function rowsForYear<R extends { year?: number }>(rows: R[], year: number): R[] {
  const own = rows.filter((r) => r.year === year)
  return own.length ? own : rows.filter((r) => r.year === undefined)
}

export const familyWeekForYear = (weeks: FamilyWeeks, year: number): number => weeks.byYear[year] ?? weeks.base

// Older rows had one free-text time such as "9:30". Turn it into a start time, assuming times from 1:00 to
// 6:59 are afternoon (the Sunday schedule runs from early morning to mid-afternoon).
export function legacyStart(time: string | undefined): string | undefined {
  const m = time?.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return undefined
  let hour = Number(m[1])
  if (hour < 7) hour += 12
  if (hour > 23) return undefined
  return `${String(hour).padStart(2, '0')}:${m[2]}`
}

export const rowStart = (row: Pick<ScheduleRow, 'start' | 'time'>) => row.start ?? legacyStart(row.time)

// Does this row run across the Family Sunday block, rather than the block covering it? The Family Sunday
// block fills its whole column; the 2-hour block is the one row that sits over it. A row can be switched
// on or off explicitly; until then, a row that mentions a 2-hour block is the one that runs across.
export function cutsFamilyBlock(row: Pick<ScheduleRow, 'all' | 'overFamily'>): boolean {
  return row.overFamily ?? /\b(2|two)[- ]hour\b/i.test(row.all)
}

// How the Family Sunday week is drawn: one solid block down that week's column, from the first row to the
// last, broken only by rows that run across it.
//   0   this row runs across the block (it has its own cell in the Family Sunday column)
//  -1   this row's cell in that column is covered by the block that started above it
//   n   a block starts here and covers n rows
export function familyBlockSpans(rows: Pick<ScheduleRow, 'all' | 'overFamily'>[]): number[] {
  const spans: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (cutsFamilyBlock(rows[i])) spans.push(0)
    else if (i > 0 && !cutsFamilyBlock(rows[i - 1])) spans.push(-1)
    else {
      let n = 0
      while (i + n < rows.length && !cutsFamilyBlock(rows[i + n])) n++
      spans.push(n)
    }
  }
  return spans
}
