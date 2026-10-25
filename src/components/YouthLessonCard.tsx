import { addMonths, format, startOfMonth } from 'date-fns'
import { useState } from 'react'
import { youthLessonsFor } from '../data/youthLessons'

export default function YouthLessonCard() {
  const [offset, setOffset] = useState(0)
  // Arrows move by month; only the current month highlights today's Sunday.
  const lessons = youthLessonsFor(offset === 0 ? new Date() : startOfMonth(addMonths(new Date(), offset)))

  return (
    <div className="card">
      <div className="card-head">
        <h2>{lessons ? `${format(lessons.sunday, 'MMMM')}: ${lessons.chapter ?? 'Youth Sunday lesson'}` : 'Youth Sunday lesson'}</h2>
        <button onClick={() => setOffset(offset - 1)} aria-label="Previous month">‹</button>
        <button onClick={() => setOffset(0)} disabled={offset === 0}>Today</button>
        <button onClick={() => setOffset(offset + 1)} aria-label="Next month">›</button>
      </div>
      {lessons ? (
        <>
          <ul className="plain" style={{ marginTop: 0 }}>
            {lessons.links.map((l) => {
              const on = offset === 0 && lessons.current.includes(l.key)
              return (
                <li key={l.key} style={{ marginBottom: 6 }}>
                  <span className={on ? undefined : 'muted'} style={on ? { fontWeight: 700 } : undefined}>
                    {on ? '→ ' : ''}{l.label}
                  </span>
                  <a className="lesson-link" href={l.url} target="_blank" rel="noopener noreferrer" style={{ textAlign: 'right', ...(on ? { fontWeight: 700 } : {}) }}>
                    {l.detail}
                  </a>
                </li>
              )
            })}
          </ul>
          <p style={{ marginBottom: 0 }}>
            <a className="lesson-link" href={lessons.monthUrl} target="_blank" rel="noopener noreferrer">All {format(lessons.sunday, 'MMMM')} lessons and activities</a>
          </p>
        </>
      ) : (
        <p className="muted">The youth Sunday curriculum starts September 2026.</p>
      )}
    </div>
  )
}
