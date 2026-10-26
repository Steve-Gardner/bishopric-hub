import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import AppointmentsSetup from './setup/AppointmentsSetup'
import EventsSetup from './setup/EventsSetup'
import ConductingSchedule from './setup/ConductingSchedule'
import GratitudeSetup from './setup/GratitudeSetup'
import MonthlySchedule from './setup/MonthlySchedule'
import ScheduleTab from './calendar/ScheduleTab'
import SpecialMeetingsSetup from './setup/SpecialMeetingsSetup'
import YouthActivitiesSetup from './setup/YouthActivitiesSetup'
import './ScheduleTiles.css'

interface Section { id: string; title: string; note: string; body: ReactNode }

// The Schedule tab is a grid of tiles; tapping one opens that section. The first four are the everyday work,
// the last four are how the schedule itself is set up.
export default function Schedule() {
  const params = useSearchParams()[0]
  const { key: visit } = useLocation() // changes with every visit, even to the same link
  const apptDate = params.get('appointments')
  const activityDate = params.get('activity')
  const editActivityId = params.get('editActivity') // a youth activity to change, from the Calendar
  const editId = params.get('edit') // an event to change, from the Calendar
  const newEventDate = params.get('newEvent') // a day to start a new event on
  const [startWizard, setStartWizard] = useState(false) // the button at the top asks the wizard to begin
  const [tile, setTile] = useState<string | null>(params.get('open')) // links here name the section to open (?open=...)

  // A link that arrives while this page is already showing opens its section too.
  const requested = params.get('open')
  useEffect(() => { if (requested) setTile(requested) }, [requested, visit])
  useEffect(() => { window.scrollTo(0, 0) }, [tile])

  const sections: Section[] = [
    { id: 'setup-appointments', title: 'Interviews & Appointments', note: 'Book interviews, see a day', body: <div className="fold-pad"><AppointmentsSetup initialDate={apptDate ?? undefined} startWizard={startWizard} onWizardStarted={() => setStartWizard(false)} /></div> },
    { id: 'setup-events', title: 'Meetings and Calendar Events', note: 'Add, change, delete', body: <div className="fold-pad"><EventsSetup editId={editId ?? undefined} occurrence={params.get('occ') ?? undefined} newDate={newEventDate ?? undefined} /></div> },
    { id: 'setup-youth-activities', title: 'Youth Activities', note: 'Plan activities', body: <YouthActivitiesSetup key={activityDate ?? editActivityId ?? ''} initialDate={activityDate ?? undefined} editId={editActivityId ?? undefined} /> },
    { id: 'setup-gratitude', title: 'Gratitude Statement & Roles and Responsibilities', note: 'Who gives them', body: <div className="fold-pad"><GratitudeSetup /></div> },
    { id: 'setup-monthly-schedule', title: "Change a Month's Schedule", note: 'Rearrange one month', body: <MonthlySchedule /> },
    { id: 'setup-conducting', title: 'Conducting Schedule', note: 'Who conducts', body: <div className="fold-pad"><ConductingSchedule /></div> },
    { id: 'setup-default-schedule', title: 'Default Monthly Meeting Schedule', note: 'The normal Sunday', body: <div className="fold-pad"><p className="muted">The normal Sunday schedule by week of the month. Every month starts as this; change a single Sunday in Change a Month's Schedule.</p><ScheduleTab /></div> },
    { id: 'setup-special', title: 'Special Sacrament Meeting Dates', note: 'Conference, Easter, program', body: <div className="fold-pad"><SpecialMeetingsSetup /></div> },
  ]
  const open = sections.find((x) => x.id === tile)
  const tileButton = (x: Section) => (
    <button key={x.id} className="tile" onClick={() => setTile(x.id)}>
      <strong>{x.title}</strong>
      <span className="muted small">{x.note}</span>
    </button>
  )

  return (
    <section>
      <div className="agenda-head" style={{ marginTop: 0 }}>
        <h1>Schedule</h1>
        <button className="primary" onClick={() => { setTile('setup-appointments'); setStartWizard(true) }} aria-label="Schedule an interview or meeting">+ Interview/Meeting</button>
      </div>
      <hr className="day-divider" />

      {open ? (
        <>
          <button className="tile-back" onClick={() => setTile(null)}>‹ All sections</button>
          <h2 className="tile-title">{open.title}</h2>
          <div className="tile-body">{open.body}</div>
        </>
      ) : (
        <div className="tiles schedule-tiles">
          {sections.slice(0, 4).map(tileButton)}
          <hr className="day-divider tiles-divider" />
          {sections.slice(4).map(tileButton)}
        </div>
      )}
    </section>
  )
}
