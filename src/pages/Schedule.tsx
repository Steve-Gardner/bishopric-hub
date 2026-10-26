import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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

  // Opens Interviews & Appointments if it is closed, brings it into view, and starts the wizard.
  const beginScheduling = () => {
    try { localStorage.setItem(key('setup-appointments'), '1') } catch { /* private mode */ }
    const section = document.querySelector<HTMLDetailsElement>('[data-fold="setup-appointments"]')
    if (section && !section.open) section.open = true
    setStartWizard(true)
    window.setTimeout(() => section?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150)
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
