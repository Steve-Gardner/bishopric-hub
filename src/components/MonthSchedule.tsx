import { useState } from 'react'
import { addMonths, format, parseISO, startOfMonth } from 'date-fns'
import { fmtRange } from '../data/format'
import { rowsForYear } from '../data/schedule'
import { sundaysOf } from '../data/schedulePlan'
import { resolveDay } from '../data/sundayPlan'
import { useScheduleData } from './useScheduleData'

const short = (iso: string) => format(parseISO(iso), 'MMM d')
const ordinal = (n: number) => ['1st', '2nd', '3rd', '4th', '5th'][n - 1]

// Read-only view of a month of Sundays: the default schedule with any changes made on the Schedule tab.
export default function MonthSchedule() {
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const { rows, edits, familyWeek, special } = useScheduleData()
  const days = sundaysOf(month).map((d) => resolveDay(d, rows, edits, familyWeek, special))

  return (
    <>
      <div className="cal-head">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">‹</button>
        <h2>{format(month, 'MMMM yyyy')}</h2>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">›</button>
      </div>
      {rowsForYear(rows, month.getFullYear()).length === 0 && <p className="muted">No schedule yet. Set up the default schedule under Schedule.</p>}
      <ul className="board">
        {days.map((day) => (
          <li key={day.date} className="board-row">
            <div className="board-head">
              <strong>{short(day.date)}</strong> <span className="muted">{ordinal(day.week)}</span>
              {day.labels.map((l) => <span key={l} className="count" style={{ marginLeft: 6 }}>{l}</span>)}
            </div>
            <div className="board-blocks">
              {day.closed && <span className="muted">No meetings scheduled.</span>}
              {day.family && (
                <div className="blk blk-blue">
                  <span className="blk-time">All day</span>
                  <span className="blk-text" style={{ fontWeight: 400 }}>Family Sunday · No meetings</span>
                </div>
              )}
              {day.blocks.map((b) => (
                <div key={b.key} className={`blk blk-${b.tone}`}>
                  <span className="blk-time">{fmtRange(b.start, b.end) || 'No time'}</span>
                  <span className="blk-text">{b.text}</span>
                  {b.movedFrom && <span className="blk-note">moved from {short(b.movedFrom)}</span>}
                </div>
              ))}
              {!day.closed && !day.family && day.blocks.length === 0 && <span className="muted">Nothing scheduled.</span>}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
