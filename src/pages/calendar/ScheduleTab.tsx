import { useEffect, useState } from 'react'
import { fmtTime } from '../../data/format'
import {
  DEFAULT_FAMILY_SUNDAY_WEEK, FAMILY_SUNDAY_SETTING, cutsFamilyBlock, familyBlockSpans, familySettingId, rowStart, rowsForYear,
} from '../../data/schedule'
import { scheduleStore, settingStore } from '../../data/store'
import type { ScheduleRow, Tone } from '../../data/types'

const TONES: Record<Tone, string> = { none: 'None', green: 'Green', yellow: 'Yellow', gray: 'Gray', blue: 'Blue' }
const WEEKS = [1, 2, 3, 4, 5]

const blank = (order: number, year?: number): ScheduleRow => ({
  id: crypto.randomUUID(), order, start: '', end: '', all: '', weeks: ['', '', '', '', ''], tone: 'none', overFamily: false, year,
})

// Which Sunday-of-the-month column is "this week" (days 1-7 = week 1, etc.).
const thisWeek = () => Math.min(5, Math.ceil(new Date().getDate() / 7))

const thisYear = new Date().getFullYear()

// The Default Schedule: the normal Sunday pattern by week of the month. Pick a year to see or plan that year.
// Every year uses the shared schedule until it is planned separately, so next year can be worked out ahead of time.
export default function ScheduleTab() {
  const [allRows, setAllRows] = useState<ScheduleRow[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [year, setYear] = useState(thisYear)
  const [editing, setEditing] = useState<ScheduleRow | null>(null)

  const reload = async () => {
    setAllRows((await scheduleStore.list()).sort((a, b) => a.order - b.order))
    setSettings(Object.fromEntries((await settingStore.list()).map((s) => [s.id, s.value])))
  }
  useEffect(() => { reload() }, [])

  const planned = allRows.some((r) => r.year === year) // this year has a schedule of its own
  const rows = rowsForYear(allRows, year)
  const yearOptions = [...new Set([thisYear, thisYear + 1, thisYear + 2, ...allRows.flatMap((r) => (r.year ? [r.year] : []))])].sort()

  // Family Sunday: this year's own choice when the year is planned, otherwise the shared one. 0 = not scheduled.
  const familySetting = planned ? familySettingId(year) : FAMILY_SUNDAY_SETTING
  const familyWeek = Number(settings[familySetting] ?? settings[FAMILY_SUNDAY_SETTING] ?? DEFAULT_FAMILY_SUNDAY_WEEK)
  const chooseFamilyWeek = async (week: number) => {
    await settingStore.save({ id: familySetting, value: String(week) })
    reload()
  }

  // Plan the year separately: copy what it uses now, then change it freely without touching other years.
  const planSeparately = async () => {
    await Promise.all(rows.map((r) => scheduleStore.save({ ...r, id: crypto.randomUUID(), year })))
    await settingStore.save({ id: familySettingId(year), value: String(familyWeek) })
    reload()
  }
  const useShared = async () => {
    if (!confirm(`Remove the separate ${year} schedule and use the shared schedule again?`)) return
    await Promise.all(allRows.filter((r) => r.year === year).map((r) => scheduleStore.remove(r.id)))
    await settingStore.remove(familySettingId(year))
    reload()
  }

  const isSaved = (r: ScheduleRow) => allRows.some((x) => x.id === r.id)
  const nextOrder = () => (rows.length ? Math.max(...rows.map((r) => r.order)) + 1 : 0)

  // Open a row for editing; an older row's single time label becomes its start time.
  const edit = (r: ScheduleRow) => setEditing({ ...r, start: rowStart(r) ?? '', end: r.end ?? '', overFamily: cutsFamilyBlock(r) })

  const save = async () => {
    if (!editing) return
    const { time: _legacy, ...rest } = editing
    await scheduleStore.save({ ...rest, start: editing.start || undefined, end: editing.end || undefined, overFamily: editing.overFamily ?? false })
    setEditing(null)
    reload()
  }
  const remove = async () => {
    if (!editing) return
    await scheduleStore.remove(editing.id)
    setEditing(null)
    reload()
  }
  const move = async (dir: -1 | 1) => {
    if (!editing) return
    const i = rows.findIndex((r) => r.id === editing.id)
    const other = rows[i + dir]
    if (i < 0 || !other) return
    await scheduleStore.save({ ...rows[i], order: other.order })
    await scheduleStore.save({ ...other, order: rows[i].order })
    setEditing(null)
    reload()
  }

  const spans = familyBlockSpans(rows)
  const familyIndex = familyWeek - 1 // which week column is Family Sunday (-1 for none)

  // The solid Family Sunday block: it starts on the first row of a run and covers the rows beneath it.
  const block = (i: number) => (
    <td key="family" rowSpan={spans[i]} className="family-block" onClick={(ev) => ev.stopPropagation()}>
      <strong>Family Sunday</strong>
      <span>No meetings</span>
    </td>
  )

  // The cells for one row, after its time. Every week's cell in the Family Sunday column is covered by the
  // block, except on rows that run across it (like the 2-hour block); a row that applies to every week
  // wraps around the block, with its text on each side.
  const rowCells = (r: ScheduleRow, i: number) => {
    const hasBlock = familyIndex >= 0
    const runsAcross = cutsFamilyBlock(r)
    if (r.all) {
      if (!hasBlock || runsAcross) return <td colSpan={5} className="all">{r.all}</td>
      return [
        familyIndex > 0 && <td key="left" colSpan={familyIndex} className="all">{r.all}</td>,
        spans[i] > 0 && block(i),
        familyIndex < 4 && <td key="right" colSpan={4 - familyIndex} className="all">{r.all}</td>,
      ]
    }
    return r.weeks.map((w, wi) => {
      if (!hasBlock || wi !== familyIndex || runsAcross) return <td key={wi}>{w}</td>
      return spans[i] > 0 ? block(i) : null // covered by the block above
    })
  }

  return (
    <>
      <div className="agenda-head" style={{ marginTop: 0 }}>
        <p className="muted" style={{ margin: 0 }}>Tap a row to edit.</p>
        <button className="primary" onClick={() => setEditing(blank(nextOrder(), planned ? year : undefined))}>+ Row</button>
      </div>
      <label className="family-pick">Year
        <select value={year} onChange={(ev) => setYear(Number(ev.target.value))}>
          {yearOptions.map((y) => <option key={y} value={y}>{y}{allRows.some((r) => r.year === y) ? ' (planned)' : ''}</option>)}
        </select>
      </label>
      {planned ? (
        <p className="muted small">Planned for {year} only. <button className="linkish" onClick={useShared}>Use the shared schedule instead</button></p>
      ) : (
        <p className="muted small">
          This is the shared schedule, used by every year that isn't planned separately, so changes here apply to all of them.{' '}
          <button className="linkish" onClick={planSeparately}>Plan {year} separately</button>
        </p>
      )}
      <label className="family-pick">Family Sunday is
        <select value={familyWeek} onChange={(ev) => chooseFamilyWeek(Number(ev.target.value))}>
          <option value={0}>not scheduled</option>
          {WEEKS.map((w) => <option key={w} value={w}>Week {w}</option>)}
        </select>
      </label>

      {rows.length === 0 ? (
        <p className="muted">No time slots yet. Add the first row, such as the 8:15 Bishopric Meeting.</p>
      ) : (
        <div className="scroll">
          <table className="sched">
            <thead>
              <tr>
                <th>Time</th>
                {WEEKS.map((w) => <th key={w} className={w === thisWeek() ? 'now' : ''}>Wk {w}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const start = rowStart(r)
                return (
                  <tr key={r.id} className={`tone-${r.tone}`} onClick={() => edit(r)}>
                    <td className="time">
                      <div>{fmtTime(start) || '—'}</div>
                      {r.end && <div className="until">to {fmtTime(r.end)}</div>}
                    </td>
                    {rowCells(r, i)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="modal" onClick={() => setEditing(null)}>
          <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); save() }}>
            <h2>{isSaved(editing) ? 'Edit time slot' : 'New time slot'}</h2>
            <div className="row">
              <label>Starts
                <input autoFocus type="time" value={editing.start ?? ''} onChange={(ev) => setEditing({ ...editing, start: ev.target.value })} />
              </label>
              <label>Ends
                <input type="time" value={editing.end ?? ''} onChange={(ev) => setEditing({ ...editing, end: ev.target.value })} />
              </label>
            </div>
            <label>Color
              <select value={editing.tone} onChange={(ev) => setEditing({ ...editing, tone: ev.target.value as Tone })}>
                {Object.entries(TONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Every week (spans all columns; leave blank to fill weeks separately)
              <input value={editing.all} onChange={(ev) => setEditing({ ...editing, all: ev.target.value })} />
            </label>
            <label className="check-row">
              <input type="checkbox" checked={!!editing.overFamily} onChange={(ev) => setEditing({ ...editing, overFamily: ev.target.checked })} />
              Show across the Family Sunday block (like the 2-hour block)
            </label>
            {!editing.all && WEEKS.map((w, i) => (
              <label key={w}>Week {w}{w === familyWeek ? ' (shown as the Family Sunday block)' : ''}
                <input value={editing.weeks[i]} onChange={(ev) => {
                  const weeks = [...editing.weeks]
                  weeks[i] = ev.target.value
                  setEditing({ ...editing, weeks })
                }} />
              </label>
            ))}
            <div className="row">
              <button type="submit" className="primary">Save</button>
              <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              {isSaved(editing) && (
                <>
                  <button type="button" onClick={() => move(-1)} aria-label="Move up">↑</button>
                  <button type="button" onClick={() => move(1)} aria-label="Move down">↓</button>
                  <button type="button" className="danger" onClick={remove}>Delete</button>
                </>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  )
}
