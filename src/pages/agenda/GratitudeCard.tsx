import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { gratitudeStore } from '../../data/store'
import type { GratitudeAssignment } from '../../data/types'

const pretty = (iso: string) => format(parseISO(iso), 'MMM d')

interface Props {
  date: string // the selected meeting
}

// Who gives the gratitude statement for the selected meeting, with the next few weeks in small text.
// The assignments themselves are made in Setup.
export default function GratitudeCard({ date }: Props) {
  const [items, setItems] = useState<GratitudeAssignment[]>([])
  useEffect(() => { gratitudeStore.list().then(setItems) }, [date])

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
  const current = sorted.find((i) => i.date === date)
  const later = sorted.filter((i) => i.date > date).slice(0, 4)

  return (
    <div className="card gratitude">
      <div className="gratitude-title">
        <h2>Gratitude Statement &amp; Roles and Responsibilities</h2>
        <Link to="/schedule?open=setup-gratitude" className="icon-btn" aria-label="Edit gratitude assignments in Schedule" title="Edit assignments in Schedule">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </Link>
      </div>
      <div>
        <div className="gratitude-now">
          {current ? <strong>{current.person}</strong> : <span className="muted">No one assigned yet</span>}
        </div>
        {later.length > 0 && (
          <p className="muted small">Coming up: {later.map((l) => `${pretty(l.date)} — ${l.person}`).join(' · ')}</p>
        )}
      </div>
    </div>
  )
}
