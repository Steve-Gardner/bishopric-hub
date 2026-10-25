import { useSearchParams } from 'react-router-dom'
import Fold from '../components/Fold'
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

  return (
    <section>
      <h1>Schedule</h1>

      <Fold red id="setup-appointments" title="Interviews & Appointments">
        <div className="fold-pad"><AppointmentsSetup initialDate={apptDate ?? undefined} /></div>
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
