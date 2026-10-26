import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Fold, { key } from '../components/Fold'
import { useOpenFromLink } from '../components/useOpenFromLink'
import AppointmentsSetup from './setup/AppointmentsSetup'
import EventsSetup from './setup/EventsSetup'
import ConductingSchedule from './setup/ConductingSchedule'
import GratitudeSetup from './setup/GratitudeSetup'
import MonthlySchedule from './setup/MonthlySchedule'
import ScheduleTab from './calendar/ScheduleTab'
import SpecialMeetingsSetup from './setup/SpecialMeetingsSetup'
import YouthActivitiesSetup from './setup/YouthActivitiesSetup'
import './ScheduleTiles.css'

export default function Schedule() {
  // Links here name the section to open (?open=...). The Calendar also passes the day to work on.
  useOpenFromLink()
  const params = useSearchParams()[0]
  const apptDate = params.get('appointments')
  const activityDate = params.get('activity')
  const editActivityId = params.get('editActivity') // a youth activity to change, from the Calendar
  const editId = params.get('edit') // an event to change, from the Calendar
  const newEventDate = params.get('newEvent') // a day to start a new event on
  const [startWizard, setStartWizard] = useState(false) // the Schedule button asks the wizard to begin
  const tilesView = params.get('view') === 'tiles' // a trial layout: the sections as tiles (open it with #/schedule?view=tiles)
  const [tile, setTile] = useState<string | null>(null)

  // Opens Interviews & Appointments if it is closed, brings it into view, and starts the wizard.
  const beginScheduling = () => {
    if (tilesView) { setTile('setup-appointments'); setStartWizard(true); return }
    try { localStorage.setItem(key('setup-appointments'), '1') } catch { /* private mode */ }
    const section = document.querySelector<HTMLDetailsElement>('[data-fold="setup-appointments"]')
    if (section && !section.open) section.open = true
    setStartWizard(true)
    window.setTimeout(() => section?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150)
  }

  const sections: { id: string; title: string; note: string; red?: boolean; body: React.ReactNode }[] = [
    { id: 'setup-appointments', title: 'Interviews & Appointments', note: 'Book interviews, see a day', body: <div className="fold-pad"><AppointmentsSetup initialDate={apptDate ?? undefined} startWizard={startWizard} onWizardStarted={() => setStartWizard(false)} /></div> },
    { id: 'setup-events', title: 'Meetings and Calendar Events', note: 'Add, change, delete', body: <div className="fold-pad"><EventsSetup editId={editId ?? undefined} occurrence={params.get('occ') ?? undefined} newDate={newEventDate ?? undefined} /></div> },
    { id: 'setup-youth-activities', title: 'Youth Activities', note: 'Plan activities', body: <YouthActivitiesSetup key={activityDate ?? editActivityId ?? ''} initialDate={activityDate ?? undefined} editId={editActivityId ?? undefined} /> },
    { id: 'setup-gratitude', title: 'Gratitude Statement & Roles and Responsibilities', note: 'Who gives them', body: <div className="fold-pad"><GratitudeSetup /></div> },
    { id: 'setup-monthly-schedule', title: "Change a Month's Schedule", note: 'Rearrange one month', body: <MonthlySchedule /> },
    { id: 'setup-conducting', title: 'Conducting Schedule', note: 'Who conducts', body: <div className="fold-pad"><ConductingSchedule /></div> },
    { id: 'setup-default-schedule', title: 'Default Monthly Meeting Schedule', note: 'The normal Sunday', body: <div className="fold-pad"><p className="muted">The normal Sunday schedule by week of the month. Every month starts as this; change a single Sunday in Monthly Schedule above.</p><ScheduleTab /></div> },
    { id: 'setup-special', title: 'Special Sacrament Meeting Dates', note: 'Conference, Easter, program', body: <div className="fold-pad"><SpecialMeetingsSetup /></div> },
  ]
  const open = sections.find((x) => x.id === tile)

  if (tilesView) {
    return (
      <section>
        <div className="agenda-head" style={{ marginTop: 0 }}>
          <h1>Schedule</h1>
          <button className="primary" onClick={beginScheduling} aria-label="Schedule an interview or meeting">+ Interview/Meeting</button>
        </div>
        <hr className="day-divider" />
        <p className="muted small">Trial layout. <Link to="/schedule">Back to the normal layout</Link></p>
        {open ? (
          <>
            <button className="tile-back" onClick={() => setTile(null)}>‹ All sections</button>
            <h2 className="tile-title">{open.title}</h2>
            <div className="tile-body">{open.body}</div>
          </>
        ) : (
          <div className="tiles schedule-tiles">
            {sections.map((x) => (
              <button key={x.id} className="tile" onClick={() => setTile(x.id)}>
                <strong>{x.title}</strong>
                <span className="muted small">{x.note}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section>
      <div className="agenda-head" style={{ marginTop: 0 }}>
        <h1>Schedule</h1>
        <button className="primary" onClick={beginScheduling} aria-label="Schedule an interview or meeting">+ Interview/Meeting</button>
      </div>
      <hr className="day-divider" />

      <Fold red id="setup-appointments" title="Interviews & Appointments">
        <div className="fold-pad"><AppointmentsSetup initialDate={apptDate ?? undefined} startWizard={startWizard} onWizardStarted={() => setStartWizard(false)} /></div>
      </Fold>

      <Fold red id="setup-events" title="Meetings and Calendar Events">
        <div className="fold-pad"><EventsSetup editId={editId ?? undefined} occurrence={params.get('occ') ?? undefined} newDate={newEventDate ?? undefined} /></div>
      </Fold>

      <Fold red id="setup-youth-activities" title="Youth Activities">
        <YouthActivitiesSetup key={activityDate ?? editActivityId ?? ''} initialDate={activityDate ?? undefined} editId={editActivityId ?? undefined} />
      </Fold>

      <Fold red id="setup-gratitude" title="Gratitude Statement & Roles and Responsibilities">
        <div className="fold-pad"><GratitudeSetup /></div>
      </Fold>

      <hr className="day-divider" />

      <Fold red id="setup-monthly-schedule" title="Change a Month's Schedule">
        <MonthlySchedule />
      </Fold>

      <Fold red id="setup-conducting" title="Conducting Schedule">
        <div className="fold-pad"><ConductingSchedule /></div>
      </Fold>

      <Fold red id="setup-default-schedule" title="Default Monthly Meeting Schedule">
        <div className="fold-pad">
          <p className="muted">The normal Sunday schedule by week of the month. Every month starts as this; change a single Sunday in Monthly Schedule above.</p>
          <ScheduleTab />
        </div>
      </Fold>


      <Fold red id="setup-special" title="Special Sacrament Meeting Dates">
        <div className="fold-pad"><SpecialMeetingsSetup /></div>
      </Fold>
    </section>
  )
}
