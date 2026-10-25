import { addDays } from 'date-fns'
import { useState } from 'react'
import { lessonFor, rangeLabel } from '../data/lessons'

export default function LessonCard() {
  const [offset, setOffset] = useState(0)
  const lesson = lessonFor(addDays(new Date(), offset * 7))

  return (
    <div className="card">
      <div className="card-head">
        <h2>Come, Follow Me Lesson</h2>
        <button onClick={() => setOffset(offset - 1)} aria-label="Previous week">‹</button>
        <button onClick={() => setOffset(0)} disabled={offset === 0}>Today</button>
        <button onClick={() => setOffset(offset + 1)} aria-label="Next week">›</button>
      </div>
      {lesson ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className="muted">Week {lesson.week} · {rangeLabel(lesson)}</span>
            <a className="lesson-link" href={lesson.url} target="_blank" rel="noopener noreferrer" style={{ textAlign: 'right' }}><strong>{lesson.title}</strong></a>
          </div>
        </>
      ) : (
        <p className="muted">No lesson schedule loaded for this date.</p>
      )}
    </div>
  )
}
