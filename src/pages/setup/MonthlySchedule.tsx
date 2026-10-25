import { useRef, useState } from 'react'
import { addMonths, format, parseISO, startOfMonth } from 'date-fns'
import { fmtRange, fmtTime, nextSundayIso } from '../../data/format'
import { rowsForYear } from '../../data/schedule'
import { sundaysOf } from '../../data/schedulePlan'
import {
  addBlock, moveBlock, moveFamily, removeBlock, removeFamily, resetDates, resetTime, resolveDay, restoreFamily, restoreGhost,
  retimeBlock, type Block,
} from '../../data/sundayPlan'
import { scheduleStore } from '../../data/store'
import type { Tone } from '../../data/types'
import { useScheduleData } from '../../components/useScheduleData'

const short = (iso: string) => format(parseISO(iso), 'MMM d')
const ordinal = (n: number) => ['1st', '2nd', '3rd', '4th', '5th'][n - 1]
const TONES: Record<Tone, string> = { none: 'None', green: 'Green', yellow: 'Yellow', gray: 'Gray', blue: 'Blue' }
const YOUTH_COUNCIL = /youth council/i

// One column of time: a line every 15 minutes, a heavier line every hour.
const PX_PER_MIN = 1.6
const STEP = 15
const DEFAULT_LEN = 30 // shown length for a block with no end time
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const snap = (n: number) => Math.round(n / STEP) * STEP
const hourLabel = (h: number) => format(new Date(2000, 0, 1, h), 'h a')

type Selection = { kind: 'block'; date: string; block: Block } | { kind: 'family'; date: string }

interface Placed { block: Block; lane: number; lanes: number; s: number; e: number }

// Side-by-side lanes for blocks whose times overlap, so nothing is hidden behind another block.
function layout(blocks: Block[], live?: { key: string; end: number }): Placed[] {
  const items = blocks
    .filter((b) => b.start)
    .map((block) => {
      const s = toMin(block.start!)
      const e = live?.key === block.key ? live.end : block.end ? toMin(block.end) : s + DEFAULT_LEN
      return { block, s, e: Math.max(e, s + STEP), lane: 0, lanes: 1 }
    })
    .sort((a, b) => a.s - b.s)
  let cluster: typeof items = []
  let clusterEnd = -1
  const flush = () => {
    const laneEnds: number[] = []
    for (const it of cluster) {
      let lane = laneEnds.findIndex((end) => end <= it.s)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = it.e
      it.lane = lane
    }
    for (const it of cluster) it.lanes = laneEnds.length
    cluster = []
  }
  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush()
    clusterEnd = cluster.length ? Math.max(clusterEnd, it.e) : it.e
    cluster.push(it)
  }
  flush()
  return items
}

// The Sunday schedule for one Sunday at a time, drawn as a day on a time grid. It starts as the normal pattern
// from the Default Schedule; drag a block up or down to change its time, pull its bottom edge to change its
// length, and drag it onto another Sunday tab (or tap it, switch Sundays, and tap a time) to move it there.
// Nothing here changes the normal pattern.
export default function MonthlySchedule() {
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const { rows, edits, familyWeek, special, reload } = useScheduleData()
  const dates = sundaysOf(month)
  const [picked, setPicked] = useState(nextSundayIso())
  const date = dates.includes(picked) ? picked : dates[0]
  const [selected, setSelected] = useState<Selection | null>(null)
  const [hoverMin, setHoverMin] = useState<number | null>(null) // snapped start minute under the pointer
  const [live, setLive] = useState<{ key: string; end: number } | null>(null) // a block being resized
  const [retiming, setRetiming] = useState<{ date: string; block: Block; start: string; end: string } | null>(null)
  const [adding, setAdding] = useState<{ date: string; text: string; start: string; end: string; tone: Tone } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const grab = useRef(0) // minutes between the top of a block and where it was picked up
  const [overTab, setOverTab] = useState<string | null>(null) // the Sunday tab a drag is currently over

  const days = dates.map((d) => resolveDay(d, rows, edits, familyWeek, special))
  const day = days.find((d) => d.date === date)
  if (!day) return null

  const sel = selected
  const moving = sel?.kind === 'block' ? sel.block : null
  const movingLen = moving?.start && moving.end ? toMin(moving.end) - toMin(moving.start) : null

  const changed = days.some((d) => d.blocks.some((b) => b.source === 'extra' || b.retimed) || d.ghosts.length || d.familyMovedTo !== undefined || d.familyMovedFrom !== undefined)
  const yearRows = rowsForYear(rows, month.getFullYear()) // the default schedule for this month's year
  const hasYouthCouncil = yearRows.some((r) => YOUTH_COUNCIL.test(`${r.all} ${r.weeks.join(' ')}`))
  const suggestions = [...new Set([...yearRows.flatMap((r) => [r.all, ...r.weeks]).map((t) => t.trim()).filter(Boolean), 'Youth Council'])]

  // The visible hours: 7 AM to 5 PM, stretched to fit anything earlier or later.
  const timed = day.blocks.filter((b) => b.start)
  const startHour = Math.min(7, ...timed.map((b) => Math.floor(toMin(b.start!) / 60)))
  const endHour = Math.max(17, ...timed.map((b) => Math.ceil((b.end ? toMin(b.end) : toMin(b.start!) + DEFAULT_LEN) / 60)))
  const startMin = startHour * 60
  const endMin = endHour * 60
  const height = (endMin - startMin) * PX_PER_MIN
  const placed = layout(day.blocks, live ?? undefined)
  const untimed = day.blocks.filter((b) => !b.start)

  const run = async (action: () => Promise<unknown>) => {
    await action()
    setSelected(null)
    setHoverMin(null)
    await reload()
  }

  // Where the pointer is on the grid, as a snapped start time for the block being moved.
  const minuteAt = (clientY: number) => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return null
    const len = movingLen ?? DEFAULT_LEN
    const raw = startMin + (clientY - rect.top) / PX_PER_MIN - grab.current
    return Math.max(startMin, Math.min(snap(raw), endMin - len))
  }

  const place = (start: number) => {
    if (!sel || sel.kind !== 'block') return
    const times = { start: fromMin(start), end: movingLen != null ? fromMin(start + movingLen) : '' }
    run(() => (sel.date === date ? retimeBlock(sel.block, date, times.start, times.end) : moveBlock(sel.block, sel.date, date, times)))
  }

  const tapGrid = (ev: React.MouseEvent) => {
    if (ev.target !== ev.currentTarget) return
    const m = minuteAt(ev.clientY)
    if (m === null) return
    if (moving) place(m)
    else if (!sel) setAdding({ date, text: '', start: fromMin(m), end: fromMin(m + DEFAULT_LEN), tone: 'none' })
    else setSelected(null)
  }

  const startResize = (ev: React.PointerEvent, b: Block) => {
    ev.stopPropagation()
    ev.preventDefault()
    const s = toMin(b.start!)
    let end = b.end ? toMin(b.end) : s + DEFAULT_LEN
    const move = (e: PointerEvent) => {
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      end = Math.max(s + STEP, Math.min(snap(startMin + (e.clientY - rect.top) / PX_PER_MIN), endMin))
      setLive({ key: b.key, end })
    }
    const up = async () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setLive(null)
      await retimeBlock(b, date, b.start!, fromMin(end))
      reload()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    setLive({ key: b.key, end })
  }

  // Dropping a block (or Family Sunday) on another Sunday's tab moves it there at the same time, and shows that
  // Sunday so it can be adjusted.
  const dropOnTab = (d: string) => {
    setOverTab(null)
    if (!sel || d === sel.date) return
    setPicked(d)
    if (sel.kind === 'family') {
      if (!days.find((x) => x.date === d)?.family) run(() => moveFamily(sel.date, d))
    } else {
      run(() => moveBlock(sel.block, sel.date, d))
    }
  }
  const goMonth = (n: number) => { setMonth(addMonths(month, n)); setSelected(null) }

  const addYouthCouncilToPattern = () => run(() => {
    const year = month.getFullYear()
    const inYear = yearRows
    return scheduleStore.save({
      id: crypto.randomUUID(), order: inYear.length ? Math.max(...inYear.map((r) => r.order)) + 1 : 0, start: '11:00', end: '11:30',
      all: '', weeks: ['', 'Youth Council', '', '', ''], tone: 'yellow', overFamily: false,
      year: rows.some((r) => r.year === year) ? year : undefined,
    })
  })
  const saveRetime = async () => {
    if (!retiming) return
    await retimeBlock(retiming.block, retiming.date, retiming.start, retiming.end)
    setRetiming(null)
    setSelected(null)
    reload()
  }
  const saveAdd = async () => {
    if (!adding || !adding.text.trim()) return
    await addBlock(adding.date, adding.text, adding.start, adding.end, adding.tone)
    setAdding(null)
    reload()
  }

  return (
    <div className="fold-pad">
      <div className="cal-head">
        <button onClick={() => goMonth(-1)} aria-label="Previous month">‹</button>
        <h2>{format(month, 'MMMM yyyy')}</h2>
        <button onClick={() => goMonth(1)} aria-label="Next month">›</button>
      </div>

      {!hasYouthCouncil && yearRows.length > 0 && (
        <div className="card">
          <p style={{ marginTop: 0 }}>Youth Council isn't in the Sunday meeting schedule yet.</p>
          <button onClick={addYouthCouncilToPattern}>Add it to the normal schedule: 2nd Sunday, 11:00 – 11:30</button>
        </div>
      )}

      <div className="day-tabs" role="tablist">
        {days.map((d) => (
          <button
            key={d.date}
            role="tab"
            aria-selected={d.date === date}
            className={`day-tab ${d.date === date ? 'on' : ''} ${sel && d.date !== date ? 'holding' : ''} ${overTab === d.date ? 'hot' : ''}`}
            onClick={() => setPicked(d.date)}
            onDragOver={(ev) => { if (sel && d.date !== sel.date) { ev.preventDefault(); if (overTab !== d.date) setOverTab(d.date) } }}
            onDragLeave={() => setOverTab(null)}
            onDrop={(ev) => { ev.preventDefault(); dropOnTab(d.date) }}
          >
            <strong>{short(d.date)}</strong>
            <span className="muted">
              {sel && d.date !== sel.date ? 'Drop here' : `${ordinal(d.week)}${d.labels.length ? ' · ' + d.labels[0].toLowerCase() : ''}`}
            </span>
          </button>
        ))}
      </div>

      {sel ? (
        <div className="card board-banner" role="status">
          <strong>{sel.kind === 'family' ? 'Moving Family Sunday' : `Moving ${sel.block.text}`}</strong>
          {sel.date !== date ? ` from ${short(sel.date)}. Tap a time below to place it on ${short(date)}.` : '. Tap a time to move it, or drag it.'}
          <div className="row actions">
            {sel.kind === 'family' && sel.date !== date && !day.family && (
              <button className="primary" onClick={() => run(() => moveFamily(sel.date, date))}>Make {short(date)} Family Sunday</button>
            )}
            {sel.kind === 'block' && (
              <button onClick={() => setRetiming({ date: sel.date, block: sel.block, start: sel.block.start ?? '', end: sel.block.end ?? '' })}>Change time</button>
            )}
            {sel.kind === 'block' && sel.block.source === 'template' && sel.block.retimed && (
              <button onClick={() => run(() => resetTime(sel.block))}>Reset time</button>
            )}
            {sel.kind === 'block' && <button onClick={() => run(() => removeBlock(sel.block, sel.date))}>Remove from {short(sel.date)}</button>}
            {sel.kind === 'family' && <button onClick={() => run(() => removeFamily(sel.date))}>Not Family Sunday</button>}
            <button onClick={() => setSelected(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <p className="muted">
          Starts as your normal Sunday schedule. Drag a block to a new time, or onto another Sunday's tab to move it there at the same time. Pull its bottom edge to change its length, or tap it for more.
          Tap an empty time to add a meeting. The normal schedule isn't changed.
        </p>
      )}

      <h3 className="grid-title">
        {format(parseISO(date), 'EEEE, MMMM d')}
        {day.labels.map((l) => <span key={l} className="count" style={{ marginLeft: 6 }}>{l}</span>)}
      </h3>

      {day.family && (
        <button
          className={`blk blk-blue ${sel?.kind === 'family' && sel.date === date ? 'sel' : ''}`}
          draggable
          onClick={() => setSelected(sel?.kind === 'family' && sel.date === date ? null : { kind: 'family', date })}
          onDragStart={(ev) => { ev.dataTransfer.setData('text/plain', 'family'); setSelected({ kind: 'family', date }) }}
          onDragEnd={() => setOverTab(null)}
        >
          <span className="blk-time">All day</span>
          <span className="blk-text" style={{ fontWeight: 400 }}>Family Sunday · No meetings</span>
          {day.familyMovedFrom && <span className="blk-note">moved from {short(day.familyMovedFrom)}</span>}
        </button>
      )}
      {day.closed && <p className="muted">No meetings scheduled.</p>}

      {untimed.length > 0 && (
        <div className="untimed">
          <span className="muted">No time set:</span>
          {untimed.map((b) => (
            <button key={b.key} className={`chip ${moving?.key === b.key ? 'sel' : ''}`} onClick={() => setSelected(moving?.key === b.key ? null : { kind: 'block', date, block: b })}>{b.text}</button>
          ))}
        </div>
      )}

      {!day.closed && (
        <div className="tgrid" style={{ height }}>
          <div className="taxis">
            {Array.from({ length: endHour - startHour }, (_, i) => (
              <span key={i} style={{ top: i * 60 * PX_PER_MIN }}>{hourLabel(startHour + i)}</span>
            ))}
          </div>
          <div
            ref={gridRef}
            className="tplot"
            onClick={tapGrid}
            onMouseMove={(ev) => { if (moving && ev.target === ev.currentTarget) setHoverMin(minuteAt(ev.clientY)) }}
            onMouseLeave={() => { if (moving) setHoverMin(null) }}
            onDragOver={(ev) => { if (moving) { ev.preventDefault(); setHoverMin(minuteAt(ev.clientY)) } }}
            onDrop={(ev) => { ev.preventDefault(); const m = minuteAt(ev.clientY); if (m !== null) place(m) }}
          >
            {hoverMin !== null && moving && (
              <div className="gblk gdrop" style={{ top: (hoverMin - startMin) * PX_PER_MIN, height: (movingLen ?? DEFAULT_LEN) * PX_PER_MIN }}>
                <span className="gtime">{fmtRange(fromMin(hoverMin), movingLen != null ? fromMin(hoverMin + movingLen) : undefined)}</span>
                <span className="gtext">{moving.text}</span>
              </div>
            )}
            {placed.map(({ block: b, lane, lanes, s, e }) => {
              const on = moving?.key === b.key && sel?.date === date
              const h = (e - s) * PX_PER_MIN - 2
              return (
                <div
                  key={b.key}
                  className={`gblk t-${b.tone} ${on ? 'sel' : ''} ${on && hoverMin !== null ? 'lifted' : ''} ${live?.key === b.key ? 'resizing' : ''}`}
                  style={{ top: (s - startMin) * PX_PER_MIN, height: h, left: `${(lane / lanes) * 100}%`, width: `calc(${100 / lanes}% - 2px)` }}
                  draggable={!live}
                  onClick={(ev) => { ev.stopPropagation(); setSelected(on ? null : { kind: 'block', date, block: b }) }}
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData('text/plain', b.key)
                    grab.current = (ev.clientY - ev.currentTarget.getBoundingClientRect().top) / PX_PER_MIN
                    setSelected({ kind: 'block', date, block: b })
                  }}
                  onDragEnd={() => { grab.current = 0; setHoverMin(null); setOverTab(null) }}
                >
                  <span className="gtime">{fmtRange(fromMin(s), b.end || live?.key === b.key ? fromMin(e) : undefined)}</span>
                  <span className="gtext">{b.text}</span>
                  {(b.movedFrom || b.retimed || (b.source === 'extra' && !b.movedFrom)) && h > 60 && (
                    <span className="gnote">{b.movedFrom ? `moved from ${short(b.movedFrom)}` : b.retimed ? 'time changed' : 'added'}</span>
                  )}
                  <span
                    className="gresize"
                    role="slider"
                    aria-label={`Length of ${b.text}`}
                    title="Drag to change the length"
                    onPointerDown={(ev) => startResize(ev, b)}
                    onClick={(ev) => ev.stopPropagation()}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(day.ghosts.length > 0 || day.familyMovedTo !== undefined) && (
        <div className="untimed">
          <span className="muted">Not on this Sunday:</span>
          {day.familyMovedTo !== undefined && (
            <button className="chip ghost" onClick={() => run(() => restoreFamily(day.date, day.familyMovedTo || undefined))}>
              <s>Family Sunday</s> <span className="muted">{day.familyMovedTo ? `moved to ${short(day.familyMovedTo)}` : 'removed'} · Restore</span>
            </button>
          )}
          {day.ghosts.map((g) => (
            <button key={g.key} className="chip ghost" onClick={() => run(() => restoreGhost(g, day.date))}>
              <s>{g.text}</s> <span className="muted">{g.start ? fmtTime(g.start) + ' · ' : ''}{g.movedTo ? `moved to ${short(g.movedTo)}` : 'removed'} · Restore</span>
            </button>
          ))}
        </div>
      )}

      {changed && (
        <div className="row actions">
          <button onClick={() => confirm(`Put ${format(month, 'MMMM')} back to the normal Sunday schedule?`) && run(() => resetDates(dates))}>
            Reset {format(month, 'MMMM')} to normal
          </button>
        </div>
      )}

      {retiming && (
        <div className="modal" onClick={() => setRetiming(null)}>
          <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); saveRetime() }}>
            <h2>{retiming.block.text}</h2>
            <p className="muted">Time on {short(retiming.date)} only.</p>
            <div className="row">
              <label>Starts
                <input autoFocus type="time" step={STEP * 60} value={retiming.start} onChange={(ev) => setRetiming({ ...retiming, start: ev.target.value })} />
              </label>
              <label>Ends
                <input type="time" step={STEP * 60} value={retiming.end} onChange={(ev) => setRetiming({ ...retiming, end: ev.target.value })} />
              </label>
            </div>
            <div className="row">
              <button type="submit" className="primary">Save</button>
              <button type="button" onClick={() => setRetiming(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {adding && (
        <div className="modal" onClick={() => setAdding(null)}>
          <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); saveAdd() }}>
            <h2>Add to {short(adding.date)}</h2>
            <p className="muted">Adds another meeting to this Sunday only, such as a second Ward Council.</p>
            <label>What
              <input autoFocus list="sched-suggest" value={adding.text} onChange={(ev) => setAdding({ ...adding, text: ev.target.value })} />
              <datalist id="sched-suggest">{suggestions.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
            <div className="row">
              <label>Starts
                <input type="time" step={STEP * 60} value={adding.start} onChange={(ev) => setAdding({ ...adding, start: ev.target.value })} />
              </label>
              <label>Ends
                <input type="time" step={STEP * 60} value={adding.end} onChange={(ev) => setAdding({ ...adding, end: ev.target.value })} />
              </label>
            </div>
            <label>Color
              <select value={adding.tone} onChange={(ev) => setAdding({ ...adding, tone: ev.target.value as Tone })}>
                {Object.entries(TONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <div className="row">
              <button type="submit" className="primary" disabled={!adding.text.trim()}>Add</button>
              <button type="button" onClick={() => setAdding(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
