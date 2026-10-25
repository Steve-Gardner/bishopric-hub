import { getDate, parseISO } from 'date-fns'
import { occursOn } from './recurrence'
import { cutsFamilyBlock, familyWeekForYear, rowStart, rowsForYear, type FamilyWeeks } from './schedule'
import { buildBoard, canMoveTo, isBoardMeeting, moveMeeting, restoreMeeting, skipMeeting } from './schedulePlan'
import { specialMeeting, type SpecialValues } from './special'
import { eventStore, scheduleEditStore } from './store'
import type { CalendarEvent, ScheduleEdit, ScheduleRow, Tone } from './types'

// The Sunday schedule table (Wk 1-5) is the normal pattern. This builds a real month from it, with a
// ScheduleEdit layered on for each Sunday that was changed, so a month can be rearranged without touching
// the pattern. Where a block is a Ward Council or Bishopric Meeting, the matching Calendar event is moved
// too, so the Agenda follows.

export interface Block {
  key: string
  source: 'template' | 'extra'
  rowId?: string
  editId?: string // the extra's record, or the row's override record when it has been retimed
  text: string
  start?: string
  end?: string
  tone: Tone
  movedFrom?: string
  retimed?: boolean
}

export interface Ghost {
  key: string
  rowId: string
  text: string
  start?: string
  end?: string
  tone: Tone
  movedTo?: string
}

export interface DayPlan {
  date: string
  week: number // which Sunday of the month, 1-5
  labels: string[] // Conference, Easter, and so on
  closed: boolean // General or Stake Conference: nothing is scheduled
  family: boolean
  familyMovedTo?: string // this Sunday would normally be Family Sunday but it was moved
  familyMovedFrom?: string
  blocks: Block[]
  ghosts: Ghost[]
}

export const weekOfMonth = (date: string) => Math.ceil(getDate(parseISO(date)) / 7)
export const overrideId = (rowId: string, date: string) => `ov:${rowId}:${date}`
export const familyId = (date: string) => `fam:${date}`

export function resolveDay(
  date: string, allRows: ScheduleRow[], edits: ScheduleEdit[], familyWeeks: FamilyWeeks, special: SpecialValues,
): DayPlan {
  const year = parseISO(date).getFullYear()
  const rows = rowsForYear(allRows, year) // each year can have its own schedule
  const familyWeek = familyWeekForYear(familyWeeks, year)
  const week = weekOfMonth(date)
  const sp = specialMeeting(date, special)
  const closed = !sp.canSchedule
  const here = edits.filter((e) => e.date === date)
  const famEdit = here.find((e) => e.kind === 'family')
  const family = famEdit ? !!famEdit.family : familyWeek > 0 && week === familyWeek

  const blocks: Block[] = []
  const ghosts: Ghost[] = []
  if (!closed) {
    for (const r of rows) {
      const text = (r.all || r.weeks[week - 1] || '').trim()
      if (!text) continue
      if (family && !cutsFamilyBlock(r)) continue
      const ov = here.find((e) => e.kind === 'override' && e.rowId === r.id)
      if (ov?.hidden) {
        ghosts.push({ key: ov.id, rowId: r.id, text, start: rowStart(r), end: r.end, tone: r.tone, movedTo: ov.movedTo })
        continue
      }
      const retimed = !!ov && (ov.start !== undefined || ov.end !== undefined)
      blocks.push({
        key: `${r.id}:${date}`, source: 'template', rowId: r.id, editId: ov?.id, text, tone: r.tone, retimed,
        start: (retimed ? ov.start : rowStart(r)) || undefined, end: (retimed ? ov.end : r.end) || undefined,
      })
    }
  }
  for (const e of here.filter((x) => x.kind === 'extra')) {
    blocks.push({
      key: e.id, source: 'extra', rowId: e.rowId, editId: e.id, text: e.text ?? '', start: e.start, end: e.end,
      tone: e.tone ?? 'none', movedFrom: e.movedFrom,
    })
  }
  blocks.sort((a, b) => (a.start ?? '99:99').localeCompare(b.start ?? '99:99'))

  const normallyFamily = familyWeek > 0 && week === familyWeek
  return {
    date, week, labels: sp.labels, closed, family,
    familyMovedTo: !family && normallyFamily && famEdit ? famEdit.movedTo ?? '' : undefined,
    familyMovedFrom: family && !normallyFamily ? famEdit?.movedFrom ?? '' : undefined,
    blocks, ghosts,
  }
}

// ---- Calendar events that mirror a block, so the Agenda follows a move ----

const sameName = (e: CalendarEvent, text: string) => e.title.trim().toLowerCase() === text.trim().toLowerCase()
const linked = (events: CalendarEvent[], text: string, date: string) =>
  events.filter((e) => isBoardMeeting(e) && sameName(e, text) && occursOn(e, date))

async function syncMove(text: string, from: string, to: string) {
  for (const e of linked(await eventStore.list(), text, from)) {
    const events = await eventStore.list()
    if (canMoveTo(events, e, to)) await moveMeeting(events, e, from, to)
    else if (e.recurrence) await skipMeeting(e, from) // the same meeting is already on that Sunday, so just clear this one
    else await eventStore.remove(e.id)
  }
}
async function syncRemove(text: string, date: string) {
  for (const e of linked(await eventStore.list(), text, date)) {
    if (e.recurrence) await skipMeeting(e, date)
    else await eventStore.remove(e.id)
  }
}
async function syncRestore(text: string, date: string) {
  const events = await eventStore.list()
  const chips = buildBoard(events, parseISO(date)).flatMap((r) => r.chips)
  for (const c of chips.filter((x) => x.date === date && x.state !== 'active' && sameName(x.event, text))) {
    await restoreMeeting(await eventStore.list(), c)
  }
}

// ---- Changes ----

// Move a block to another Sunday, optionally at new times there.
export async function moveBlock(block: Block, from: string, to: string, times?: { start: string; end: string }) {
  if (from === to) return
  if (block.source === 'template' && block.rowId) {
    await scheduleEditStore.save({
      id: overrideId(block.rowId, from), date: from, kind: 'override', rowId: block.rowId, hidden: true, movedTo: to,
    })
    await scheduleEditStore.save({
      id: crypto.randomUUID(), date: to, kind: 'extra', rowId: block.rowId, text: block.text,
      start: times ? times.start || undefined : block.start, end: times ? times.end || undefined : block.end,
      tone: block.tone, movedFrom: from,
    })
  } else {
    const extra = (await scheduleEditStore.list()).find((e) => e.id === block.editId)
    if (!extra) return
    if (extra.movedFrom === to && extra.rowId) {
      // Back where it started: drop the extra and the hidden marker.
      await scheduleEditStore.remove(extra.id)
      await scheduleEditStore.remove(overrideId(extra.rowId, to))
      if (times && (times.start !== (extra.start ?? '') || times.end !== (extra.end ?? ''))) {
        await scheduleEditStore.save({ id: overrideId(extra.rowId, to), date: to, kind: 'override', rowId: extra.rowId, start: times.start, end: times.end })
      }
    } else {
      await scheduleEditStore.save({
        ...extra, date: to, ...(times ? { start: times.start || undefined, end: times.end || undefined } : {}),
      })
      if (extra.movedFrom && extra.rowId) {
        const ov = (await scheduleEditStore.list()).find((e) => e.id === overrideId(extra.rowId!, extra.movedFrom!))
        if (ov) await scheduleEditStore.save({ ...ov, movedTo: to })
      }
    }
  }
  await syncMove(block.text, from, to)
}

export async function removeBlock(block: Block, date: string) {
  if (block.source === 'template' && block.rowId) {
    await scheduleEditStore.save({ id: overrideId(block.rowId, date), date, kind: 'override', rowId: block.rowId, hidden: true })
  } else if (block.editId) {
    await scheduleEditStore.remove(block.editId)
    if (block.movedFrom && block.rowId) {
      const ov = (await scheduleEditStore.list()).find((e) => e.id === overrideId(block.rowId!, block.movedFrom!))
      if (ov) await scheduleEditStore.save({ ...ov, movedTo: undefined })
    }
  }
  await syncRemove(block.text, date)
}

export async function retimeBlock(block: Block, date: string, start: string, end: string) {
  if (block.source === 'template' && block.rowId) {
    await scheduleEditStore.save({ id: overrideId(block.rowId, date), date, kind: 'override', rowId: block.rowId, start, end })
  } else {
    const extra = (await scheduleEditStore.list()).find((e) => e.id === block.editId)
    if (extra) await scheduleEditStore.save({ ...extra, start: start || undefined, end: end || undefined })
  }
}

export const resetTime = (block: Block) => (block.source === 'template' && block.editId ? scheduleEditStore.remove(block.editId) : Promise.resolve())

// Bring a hidden or moved-away table row back to this Sunday (and the extra it became, if it was moved).
export async function restoreGhost(ghost: Ghost, date: string) {
  const edits = await scheduleEditStore.list()
  const extra = edits.find((e) => e.kind === 'extra' && e.rowId === ghost.rowId && e.movedFrom === date)
  await scheduleEditStore.remove(ghost.key)
  if (extra) await scheduleEditStore.remove(extra.id)
  await syncRestore(ghost.text, date)
}

export const addBlock = (date: string, text: string, start: string, end: string, tone: Tone) =>
  scheduleEditStore.save({ id: crypto.randomUUID(), date, kind: 'extra', text: text.trim(), start: start || undefined, end: end || undefined, tone })

export async function moveFamily(from: string, to: string) {
  await scheduleEditStore.save({ id: familyId(from), date: from, kind: 'family', family: false, movedTo: to })
  await scheduleEditStore.save({ id: familyId(to), date: to, kind: 'family', family: true, movedFrom: from })
}
export const removeFamily = (date: string) => scheduleEditStore.save({ id: familyId(date), date, kind: 'family', family: false })

// Put Family Sunday back on its normal week: drop this Sunday's setting, and the one it was moved to or from.
export async function restoreFamily(date: string, other?: string) {
  await scheduleEditStore.remove(familyId(date))
  if (other) await scheduleEditStore.remove(familyId(other))
}

// Undo every change shown for these Sundays.
export async function resetDates(dates: string[]) {
  const edits = await scheduleEditStore.list()
  for (const e of edits.filter((x) => dates.includes(x.date) || dates.includes(x.movedFrom ?? '') || dates.includes(x.movedTo ?? ''))) await scheduleEditStore.remove(e.id)
  for (const d of dates) {
    const events = await eventStore.list()
    const chips = buildBoard(events, parseISO(d)).flatMap((r) => r.chips).filter((c) => c.date === d)
    for (const c of chips) {
      if (c.state !== 'active') await restoreMeeting(await eventStore.list(), c)
    }
  }
}
