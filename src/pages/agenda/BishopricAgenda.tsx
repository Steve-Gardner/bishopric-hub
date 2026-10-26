import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Fold from '../../components/Fold'
import ListEditor from '../../components/ListEditor'
import PeopleList from '../../components/PeopleList'
import { useAgendaCounts } from '../../components/useAgendaCounts'
import { useConductor } from '../../components/useConductor'
import { carryForward } from '../../data/carry'
import AgendaPopups from './AgendaPopups'
import GratitudeCard from './GratitudeCard'
import OrgNotesSection, { ORGS } from './OrgNotesSection'
import ScheduleAndEvents from './ScheduleAndEvents'

// Lists that belong to a single meeting date. Everything else on this page carries over by itself.
// Announcements, releases and sustainings are about that week only, so they are not carried over.
const ANNOUNCEMENTS = 'agenda:announcements'
const RELEASES = 'agenda:releases'
const SUSTAININGS = 'agenda:sustainings'
const CALLINGS = 'agenda:callings'
const OTHER = 'agenda'
const CARRIED_OVER = [CALLINGS, OTHER]

interface Props {
  date: string
  prevOf: (date: string) => string
}

export default function BishopricAgenda({ date, prevOf }: Props) {
  const { counts, refresh } = useAgendaCounts()
  const [version, setVersion] = useState(0) // bumped to reload the lists once items have been carried in
  const [moved, setMoved] = useState(0)

  const conductor = useConductor(date)
  const keyFor = (key: string) => `${key}@${date}`

  // Unfinished items from the previous meeting move into this one automatically.
  useEffect(() => {
    let alive = true
    setMoved(0)
    carryForward({ type: 'bishopric', keys: CARRIED_OVER, date, prevOf, today: format(new Date(), 'yyyy-MM-dd') }).then(async (n) => {
      if (!alive) return
      setMoved(n)
      await refresh()
      setVersion((v) => v + 1)
    })
    return () => { alive = false }
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const orgCount = ORGS.reduce((n, [key]) => n + (counts[key] ?? 0), 0)
  const otherCount = (counts[keyFor(CALLINGS)] ?? 0) + (counts[keyFor(OTHER)] ?? 0) + orgCount

  return (
    <>
      {moved > 0 && <p role="status" className="muted small carried-note">{moved} unfinished item{moved === 1 ? '' : 's'} carried over from the previous meeting.</p>}

      <AgendaPopups onChange={refresh} />

      <GratitudeCard date={date} />

      <Fold red id="agenda-individuals" title="Individual and Family Needs" count={counts.individuals}>
        <PeopleList placeholder="Add an individual or family" onChange={refresh} />
      </Fold>

      <div key={date + version}>
        <Fold red id={`agenda-${ANNOUNCEMENTS}`} title={<>Sacrament Announcements{conductor && <small className="conducting"> (Conducting: {conductor})</small>}</>} count={(counts[keyFor(ANNOUNCEMENTS)] ?? 0) + (counts[keyFor(RELEASES)] ?? 0) + (counts[keyFor(SUSTAININGS)] ?? 0)}>
          <ListEditor notes listKey={keyFor(ANNOUNCEMENTS)} placeholder="Announcement" onChange={refresh} />
          <Fold id={`agenda-${RELEASES}`} title="Releases" count={counts[keyFor(RELEASES)]}>
            <ListEditor listKey={keyFor(RELEASES)} placeholder="Name as Calling" onChange={refresh} />
          </Fold>
          <Fold id={`agenda-${SUSTAININGS}`} title="Sustainings" count={counts[keyFor(SUSTAININGS)]}>
            <ListEditor listKey={keyFor(SUSTAININGS)} placeholder="Name as Calling" onChange={refresh} />
          </Fold>
        </Fold>

        <Fold red id="agenda-other-items" title="Other Items" count={otherCount}>
          <Fold id={`agenda-${CALLINGS}`} title="Callings" count={counts[keyFor(CALLINGS)]}>
            <ListEditor notes listKey={keyFor(CALLINGS)} placeholder="Calling to discuss" checkable onChange={refresh} />
          </Fold>
          <Fold id="agenda-orgs" title="Organizational Notes & Needs" count={orgCount}>
            <OrgNotesSection counts={counts} onChange={refresh} />
          </Fold>
          <Fold id={`agenda-${OTHER}`} title="Other Agenda Items" count={counts[keyFor(OTHER)]}>
            <ListEditor notes listKey={keyFor(OTHER)} placeholder="Add an agenda item" checkable onChange={refresh} />
          </Fold>
        </Fold>
      </div>

      <hr className="day-divider double" />

      <ScheduleAndEvents date={date} />
    </>
  )
}
