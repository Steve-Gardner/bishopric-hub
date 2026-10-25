import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, getDay, getYear, parseISO } from 'date-fns'
import Fold from '../../components/Fold'
import { teachingStore } from '../../data/store'
import type { TeachingAssignment } from '../../data/types'

type Quorum = TeachingAssignment['quorum']
const QUORUMS: { key: Quorum; label: string }[] = [
  { key: 'deacons', label: 'Deacons' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'priests', label: 'Priests' },
]

// Every Sunday of a year, as yyyy-MM-dd.
function sundaysOf(year: number): string[] {
  let d = new Date(year, 0, 1)
  while (getDay(d) !== 0) d = addDays(d, 1)
  const out: string[] = []
  for (; getYear(d) === year; d = addDays(d, 7)) out.push(format(d, 'yyyy-MM-dd'))
  return out
}

const lessonId = (date: string) => `${date}:lesson`
const isLesson = (a: TeachingAssignment) => a.id === lessonId(a.date)

// Who teaches each quorum each Sunday, with the lesson. Sundays with no teacher are flagged. Meetings that
// replace the lesson (conference, fast Sunday) can be typed in the lesson box.
export default function TeachingSchedule() {
  const [rows, setRows] = useState<TeachingAssignment[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const load = useCallback(() => teachingStore.list().then(setRows), [])
  useEffect(() => { load() }, [load])

  const teacher = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) if (!isLesson(r) && r.teacher) m.set(r.id, r.teacher)
    return m
  }, [rows])
  const lesson = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) {
      if (isLesson(r) && r.lesson) m.set(r.date, r.lesson)
      else if (r.lesson && !m.has(r.date)) m.set(r.date, r.lesson)
    }
    return m
  }, [rows])

  const saveTeacher = async (date: string, quorum: Quorum, value: string) => {
    const id = `${date}:${quorum}`
    const v = value.trim()
    if (v === (teacher.get(id) ?? '')) return
    const existing = rows.find((r) => r.id === id)
    if (!v && existing && !existing.lesson) await teachingStore.remove(id)
    else await teachingStore.save({ ...existing, id, date, quorum, teacher: v || undefined })
    load()
  }
  const saveLesson = async (date: string, value: string) => {
    const id = lessonId(date)
    const v = value.trim()
    if (v === (lesson.get(date) ?? '')) return
    // Older rows kept the lesson beside a teacher; move it to the Sunday's own lesson row.
    await Promise.all(rows.filter((r) => r.date === date && !isLesson(r) && r.lesson).map((r) => teachingStore.save({ ...r, lesson: undefined })))
    if (!v) await teachingStore.remove(id).catch(() => undefined)
    else await teachingStore.save({ id, date, quorum: 'deacons', lesson: v })
    load()
  }

  const sundays = sundaysOf(year)
  const months = Array.from({ length: 12 }, (_, m) => sundays.filter((d) => parseISO(d).getMonth() === m))
  const today = format(new Date(), 'yyyy-MM-dd')
  const empty = (date: string) => QUORUMS.filter((q) => !teacher.get(`${date}:${q.key}`)).length
  const missing = sundays.filter((d) => d >= today && !lesson.get(d) && empty(d) > 0).length

  return (
    <div className="fold-pad">
      <div className="tabs">
        <button onClick={() => setYear(year - 1)} aria-label="Previous year">‹</button>
        <strong style={{ padding: '0 8px' }}>{year}</strong>
        <button onClick={() => setYear(year + 1)} aria-label="Next year">›</button>
      </div>
      <p className="muted">Who teaches each quorum on Sunday. An empty box is a Sunday that still needs a teacher; type a note like "Stake Conference" in the lesson box when there is no lesson.</p>
      {months.map((list, m) => list.length > 0 && (
        <Fold key={m} id={`teaching-${year}-${m}`} title={format(new Date(year, m, 1), 'MMMM')} count={list.filter((d) => d >= today && !lesson.get(d) && empty(d) > 0).length || undefined}>
          <div className="fold-pad">
            {list.map((date) => (
              <div key={date} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{format(parseISO(date), 'EEE, MMM d')}</strong>
                  <input
                    key={`l-${date}-${lesson.get(date) ?? ''}`}
                    defaultValue={lesson.get(date) ?? ''}
                    placeholder="Lesson or note"
                    aria-label={`Lesson for ${date}`}
                    style={{ flex: 1, maxWidth: '60%' }}
                    onBlur={(e) => saveLesson(date, e.target.value)}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
                  {QUORUMS.map((q) => {
                    const v = teacher.get(`${date}:${q.key}`) ?? ''
                    return (
                      <label key={q.key} className="small muted" style={{ display: 'grid', gap: 2 }}>
                        {q.label}
                        <input
                          key={`${date}-${q.key}-${v}`}
                          defaultValue={v}
                          placeholder={lesson.get(date) && !v ? '' : 'Needs teacher'}
                          onBlur={(e) => saveTeacher(date, q.key, e.target.value)}
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Fold>
      ))}
      <p className="muted small">{missing} upcoming Sunday{missing === 1 ? '' : 's'} still need a teacher.</p>
    </div>
  )
}

// How many upcoming Sundays this year still have a quorum with no teacher (for the section's badge).
export function useTeachingGaps(): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    teachingStore.list().then((rows) => {
      const today = format(new Date(), 'yyyy-MM-dd')
      const lessons = new Set(rows.filter((r) => r.lesson).map((r) => r.date))
      const have = new Set(rows.filter((r) => r.teacher).map((r) => r.id))
      setN(sundaysOf(new Date().getFullYear()).filter((d) => d >= today && !lessons.has(d) && QUORUMS.some((q) => !have.has(`${d}:${q.key}`))).length)
    })
  }, [])
  return n
}
