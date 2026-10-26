import { useCallback, useEffect, useState } from 'react'
import { nextSundayIso } from '../../data/format'
import { appointmentStore } from '../../data/store'
import type { Appointment } from '../../data/types'
import Appointments from '../calendar/Appointments'

// Interviews and appointments: book one with the wizard, see a day's bookings, and keep the to-do lists.
// The Calendar shows a day's appointments; this is where they are managed.
interface Props {
  initialDate?: string
  startWizard?: boolean // begin the booking wizard (asked for by the button at the top of the Schedule tab)
  onWizardStarted?: () => void
}

export default function AppointmentsSetup({ initialDate, startWizard, onWizardStarted }: Props) {
  const [date, setDate] = useState(initialDate ?? nextSundayIso())
  const [appts, setAppts] = useState<Appointment[]>([])

  const reload = useCallback(() => appointmentStore.list().then(setAppts), [])
  useEffect(() => { reload() }, [reload])

  return <Appointments date={date} setDate={setDate} appts={appts} reload={reload} startWizard={startWizard} onWizardStarted={onWizardStarted} />
}
