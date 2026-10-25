import { useState } from 'react'
import TodaySchedule from './TodaySchedule'
import WardTable from './WardTable'

type Panel = 'schedule' | 'events'

interface Props {
  date: string
  schedule?: boolean // include the Bishopric Schedule button (the Ward Council agenda has only Upcoming Events)
}

// Buttons at the bottom of an agenda; the one that is pressed shows its content in the space below.
// Pressing it again hides it.
export default function ScheduleAndEvents({ date, schedule = true }: Props) {
  const [panel, setPanel] = useState<Panel | null>(null) // nothing is showing until a button is pressed
  const toggle = (p: Panel) => setPanel(panel === p ? null : p)

  return (
    <>
      <div className="tabs panel-buttons" role="group" aria-label="Schedule and events">
        {schedule && (
          <button className={panel === 'schedule' ? 'primary' : ''} aria-pressed={panel === 'schedule'} onClick={() => toggle('schedule')}>Bishopric Schedule</button>
        )}
        <button className={panel === 'events' ? 'primary' : ''} aria-pressed={panel === 'events'} onClick={() => toggle('events')}>Upcoming Events</button>
      </div>
      {schedule && panel === 'schedule' && <TodaySchedule date={date} />}
      {panel === 'events' && <WardTable bare />}
    </>
  )
}
