import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import Fold from '../components/Fold'
import { useSpecialDates } from '../components/useSpecialDates'
import { nextSundayIso } from '../data/format'
import { specialMeeting } from '../data/special'
import { useStaff } from '../components/useStaff'
import { nameFor, setSunday, sundayPlan } from '../data/conducting'
import { ROLES } from '../data/roles'
import { memberStore, sacramentStore, sundayStore, youthStore } from '../data/store'
import type { Member, SacramentEntry, SundayNote, Youth } from '../data/types'
import MeetingCard from './sacrament/MeetingCard'
import SpeakersSection from './sacrament/SpeakersSection'

type Tab = 'meetings' | 'speakers'

const UPCOMING_STEP = 8 // Sundays shown ahead, and how many more each "show more" adds
const EARLIER = 6 // past Sundays always shown (older ones appear when they have items)

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export default function Sacrament() {
  const [members, setMembers] = useState<Member[]>([])
  const [youth, setYouth] = useState<Youth[]>([])
  const [entries, setEntries] = useState<SacramentEntry[]>([])
  const [sundays, setSundays] = useState<SundayNote[]>([]) // the Conducting Schedule's changes
  const { names } = useStaff()
  const [ahead, setAhead] = useState(UPCOMING_STEP)
  // Always opens on Meetings.
  const [tab, setTab] = useState<Tab>('meetings')
  const choose = setTab
  const { values: special } = useSpecialDates()

  const reload = useCallback(async () => {
    setMembers(await memberStore.list())
    setYouth(await youthStore.list())
    setEntries(await sacramentStore.list())
    setSundays(await sundayStore.list())
  }, [])
  useEffect(() => { reload() }, [reload])

  // There is a sacrament meeting every Sunday, so every Sunday is listed: the coming ones nearest first, then
  // earlier ones newest first. A Sunday outside those ranges still appears if something is on its program.
  const { upcoming, earlier } = useMemo(() => {
    const start = nextSundayIso()
    const itemDates = [...new Set(entries.map((e) => e.date))]
    const coming = Array.from({ length: ahead }, (_, i) => iso(addDays(parseISO(start), 7 * i)))
    const past = Array.from({ length: EARLIER }, (_, i) => iso(addDays(parseISO(start), -7 * (i + 1))))
    return {
      upcoming: [...new Set([...coming, ...itemDates.filter((d) => d >= start)])].sort(),
      earlier: [...new Set([...past, ...itemDates.filter((d) => d < start)])].sort().reverse(),
    }
  }, [entries, ahead])

  // The bishop and his counselors, by name from Roles. The Conducting Schedule decides who conducts.
  const leaders = ROLES.slice(0, 3).map((r) => nameFor(r.key, names))

  const card = (date: string) => (
    <MeetingCard
      key={date}
      date={date}
      entries={entries.filter((e) => e.date === date)}
      allEntries={entries}
      members={members}
      youth={youth}
      special={specialMeeting(date, special)}
      conducting={sundayPlan(date, sundays.find((n) => n.id === date), names).conducting}
      leaders={leaders}
      onConducting={async (who) => { await setSunday(date, { conducting: who }, names); reload() }}
      onChange={reload}
    />
  )

  return (
    <section>
      <h1>Sacrament Meeting</h1>

      <div className="tabs real-tabs">
        <button className={tab === 'meetings' ? 'primary' : ''} onClick={() => choose('meetings')}>Meetings</button>
        <button className={tab === 'speakers' ? 'primary' : ''} onClick={() => choose('speakers')}>Speakers</button>
      </div>

      {tab === 'meetings' ? (
        <>
          <h2 className="list-heading">Upcoming</h2>
          {upcoming.map(card)}
          <button className="show-more" onClick={() => setAhead(ahead + UPCOMING_STEP)}>Show {UPCOMING_STEP} more Sundays</button>

          <Fold red id="sacrament-previous" title="Previous Sacrament Meetings" count={earlier.length}>
            {earlier.map(card)}
          </Fold>
        </>
      ) : (
        <SpeakersSection members={members} youth={youth} entries={entries} />
      )}
    </section>
  )
}
