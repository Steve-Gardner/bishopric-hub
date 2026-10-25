import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Fold from '../components/Fold'
import { nextSundayIso } from '../data/format'
import LessonCard from '../components/LessonCard'
import YouthLessonCard from '../components/YouthLessonCard'
import { youthStore } from '../data/store'
import PatriarchalBlessings from './youth/PatriarchalBlessings'
import YouthActivities, { useYouthActivities } from './youth/YouthActivities'

export default function Fsy() {
  // Badge on the blessings section: youth who have not received a patriarchal blessing yet.
  const [waiting, setWaiting] = useState(0)
  const refresh = useCallback(
    () => youthStore.list().then((all) => setWaiting(all.filter((y) => y.status !== 'received').length)),
    [],
  )
  useEffect(() => { refresh() }, [refresh])
  const { upcoming, past } = useYouthActivities()

  return (
    <section>
      <div className="agenda-head" style={{ marginTop: 0 }}>
        <h1>Youth</h1>
      </div>
      <YouthLessonCard />
      <LessonCard />

      <Fold
        red
        id="youth-activities"
        title="Youth Activities"
        count={upcoming.length}
        action={<Link to={`/schedule?open=setup-youth-activities&activity=${nextSundayIso()}`} className="fold-add" aria-label="Add a youth activity in Schedule" title="Add in Schedule">+ Add</Link>}
      >
        <YouthActivities upcoming={upcoming} past={past} />
      </Fold>

      <Fold red id="youth-blessings" title="Patriarchal Blessings" count={waiting}>
        <PatriarchalBlessings onChange={refresh} />
      </Fold>
    </section>
  )
}
