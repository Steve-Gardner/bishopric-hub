import { useEffect, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import Fold from '../../components/Fold'
import BookingWizard from './BookingWizard'
import InterviewBoard from './InterviewBoard'
import ListEditor from '../../components/ListEditor'
import type { Names } from '../../data/conducting'
import { ROLES } from '../../data/roles'
import { memberStore, youthStore } from '../../data/store'
import type { Appointment } from '../../data/types'

// Appointments for one day, grouped by the leader they are with and sorted by time.
export function groupByLeader(appts: Appointment[], date: string, names: Names = {}): [string, Appointment[]][] {
  const map = new Map<string, Appointment[]>()
  for (const a of appts.filter((x) => x.date === date).sort((p, q) => p.time.localeCompare(q.time)))
    map.set(a.leader, [...(map.get(a.leader) ?? []), a])
  // Bishop, counselors, clerk, secretary, high councilor first (matched by title or by the name entered in
  // Roles); anyone else after, alphabetically.
  const rank = (who: string) => {
    const w = who.trim().toLowerCase()
    const i = ROLES.findIndex((r) => r.label.toLowerCase() === w || (!!names[r.key]?.trim() && names[r.key].trim().toLowerCase() === w))
    return i === -1 ? ROLES.length : i
  }
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
}

interface Props {
  date: string // the day being worked on
  setDate: (date: string) => void
  appts: Appointment[]
  reload: () => void
  startWizard?: boolean
  onWizardStarted?: () => void
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

// Booking is a short wizard that ends by tapping an open time; below it, the day's appointments and the follow-up to-do lists.
export default function Appointments({ date, setDate, appts, reload, startWizard, onWizardStarted }: Props) {
  const [version, setVersion] = useState(0) // bumped when the wizard makes something, so the board loads it
  const [youthNames, setYouthNames] = useState<string[]>([])
  const [wardNames, setWardNames] = useState<string[]>([]) // ward members and youth, suggested for a new interview
  useEffect(() => {
    Promise.all([youthStore.list(), memberStore.list()]).then(([y, m]) => {
      setYouthNames(y.map((x) => x.name).sort())
      setWardNames([...new Set([...m.map((x) => x.name), ...y.map((x) => x.name)])].sort())
    })
  }, [])
  const shift = (days: number) => setDate(iso(addDays(parseISO(date), days)))

  return (
    <>
      <BookingWizard names={wardNames} autoStart={startWizard} onStarted={onWizardStarted} onCreated={(booked) => { setDate(booked); setVersion((v) => v + 1); reload() }} />

      <hr className="day-divider" />

      <Fold red id="appt-day-schedule" title={`Schedule for ${format(parseISO(date), 'EEEE, MMM d')}`}>
        <div className="fold-pad">
        <div className="date-nav-inline appt-date">
          <button onClick={() => shift(-7)} aria-label="Previous week" title="Previous week">‹</button>
          <label className="date-chip" title="Choose a date">
            {format(parseISO(date), 'EEE, MMM d')}
            <input type="date" value={date} aria-label={`Date, ${format(parseISO(date), 'MMM d')}. Change`} onChange={(ev) => ev.target.value && setDate(ev.target.value)} />
          </label>
          <button onClick={() => shift(7)} aria-label="Next week" title="Next week">›</button>
        </div>
        <InterviewBoard date={date} appts={appts} reload={reload} version={version} />
        </div>
      </Fold>

      <Fold red id="appt-todo" title="To Do">
        <div className="fold-pad">
          <ListEditor listKey="set-apart" title="Need to be set apart" placeholder="Name and calling" checkable />
          <ListEditor listKey="youth-interviews" title="Youth interviews to do" placeholder="Name" suggestions={youthNames} checkable />
          <ListEditor listKey="followups" title="Other follow-ups" placeholder="Name and what's needed" checkable />
        </div>
      </Fold>
    </>
  )
}
