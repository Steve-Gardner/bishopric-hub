import { getDate, getDay, parseISO } from 'date-fns'

// Special sacrament meeting dates are kept as settings: one date each for Ward Conference, Easter, the Primary
// Program and Christmas, and two for Stake Conference (spring and fall).
export const SPECIAL_SETTING = {
  wardConference: 'special.ward-conference',
  stakeConference1: 'special.stake-conference-1',
  stakeConference2: 'special.stake-conference-2',
  easter: 'special.easter',
  christmas: 'special.christmas',
  primaryProgram: 'special.primary-program',
} as const

export type SpecialValues = Record<string, string> // setting id -> yyyy-MM-dd

// General Conference is the first Sunday of April and of October.
export function isGeneralConferenceSunday(dateIso: string): boolean {
  const d = parseISO(dateIso)
  return getDay(d) === 0 && getDate(d) <= 7 && (d.getMonth() === 3 || d.getMonth() === 9)
}

// Fast Sunday is the first Sunday of the month. In April and October General Conference takes the first
// Sunday, so Fast Sunday moves to the second.
export function isFastSunday(dateIso: string): boolean {
  const d = parseISO(dateIso)
  if (getDay(d) !== 0) return false
  const nth = Math.ceil(getDate(d) / 7)
  const conferenceMonth = d.getMonth() === 3 || d.getMonth() === 9
  return nth === (conferenceMonth ? 2 : 1)
}

export interface SpecialMeeting {
  labels: string[] // the events on this Sunday, in capitals, e.g. ['STAKE CONFERENCE']
  canSchedule: boolean // false on General Conference and Stake Conference Sundays: nothing is scheduled then
}

export function specialMeeting(dateIso: string, values: SpecialValues): SpecialMeeting {
  const labels: string[] = []
  let canSchedule = true
  if (isGeneralConferenceSunday(dateIso)) { labels.push('GENERAL CONFERENCE'); canSchedule = false }
  if (values[SPECIAL_SETTING.stakeConference1] === dateIso || values[SPECIAL_SETTING.stakeConference2] === dateIso) {
    labels.push('STAKE CONFERENCE')
    canSchedule = false
  }
  if (values[SPECIAL_SETTING.wardConference] === dateIso) labels.push('WARD CONFERENCE')
  if (isFastSunday(dateIso)) labels.push('FAST SUNDAY')
  if (values[SPECIAL_SETTING.easter] === dateIso) labels.push('EASTER')
  if (values[SPECIAL_SETTING.primaryProgram] === dateIso) labels.push('PRIMARY PROGRAM')
  if (values[SPECIAL_SETTING.christmas] === dateIso) labels.push('CHRISTMAS')
  return { labels, canSchedule }
}
