import { useEffect, useState } from 'react'
import { addDays, format, getDay } from 'date-fns'
import AttendeePicker from '../../components/AttendeePicker'
import NameSuggest from '../../components/NameSuggest'
import { useBlocker } from '../../components/useBlocker'
import { useStaff } from '../../components/useStaff'
import { everyone, type Attendees } from '../../data/attendees'
import { appointmentConflicts, eventConflicts } from '../../data/conflicts'
import { fmtTime } from '../../data/format'
import type { Slot } from '../../data/openSlots'
import { defaultRecurrence } from '../../data/recurrence'
import { ROLES, type RoleKey } from '../../data/roles'
import { appointmentStore, eventStore } from '../../data/store'
import type { Appointment, CalendarEvent } from '../../data/types'
import SlotPicker from './SlotPicker'
import './wizard.css'

const LENGTHS = [10, 15, 20, 30, 45, 60, 90]
type Kind = 'interview' | 'meeting'
type Repeat = 'none' | 'weekly' | 'monthly'

interface Props {
  names: string[] // ward members, suggested while typing an interview's name
  onCreated: (date: string) => void // the day it was booked on, so the page can show it
  autoStart?: boolean // begin straight away, as if the big red button had been tapped
  onStarted?: () => void
}

const COUNSELORS: RoleKey[] = ['first-counselor', 'second-counselor']
const nextSunday = () => { let d = addDays(new Date(), 1); while (getDay(d) !== 0) d = addDays(d, 1); return format(d, 'yyyy-MM-dd') }
const addMin = (t: string, m: number) => { const [h, mm] = t.split(':').map(Number); const x = h * 60 + mm + m; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}` }

// A big red button starts it. First question: interview or meeting? An interview needs a name, a length, and
// whether it is with the bishop or a counselor; then the open times are listed and one tap books it. A meeting
// needs a title, a length, who attends (everyone to start with), whether it repeats, and a day and time.
export default function BookingWizard({ names, onCreated, autoStart, onStarted }: Props) {
  const { names: staff } = useStaff()
  const { block, dialog } = useBlocker()
  const [withWho, setWithWho] = useState<'bishop' | 'counselor'>('bishop')
  const [when, setWhen] = useState({ date: nextSunday(), time: '09:30' })
  const [step, setStep] = useState(-1) // -1: just the button
  useEffect(() => { if (autoStart) { setStep((s) => (s === -1 ? 0 : s)); onStarted?.() } }, [autoStart]) // eslint-disable-line react-hooks/exhaustive-deps
  const [kind, setKind] = useState<Kind>('interview')
  const [name, setName] = useState('') // the interview's person, or the meeting's title
  const [minutes, setMinutes] = useState(0)
  const [customLength, setCustomLength] = useState(false) // typing a length instead of choosing one of the buttons
  const [attendees, setAttendees] = useState<Attendees>(everyone)
  const [repeat, setRepeat] = useState<Repeat>('none')

  const stepsFor = kind === 'interview' ? 5 : 6 // kind, name, length, then who it is with and the time (or who attends, repeats, when)
  const finish = () => { setStep(-1); setName(''); setMinutes(0); setCustomLength(false); setAttendees(everyone()); setRepeat('none') }

  const label = (role: RoleKey) => staff[role]?.trim() || ROLES.find((r) => r.key === role)?.label || role
  const today = () => format(new Date(), 'yyyy-MM-dd')

  const bookInterview = async (slot: Slot) => {
    const appt: Appointment = {
      id: crypto.randomUUID(), date: slot.date, time: slot.start, leaderRole: slot.role, leader: label(slot.role),
      name: name.trim(), purpose: 'Interview', minutes,
    }
    // Checked again here, in case someone else booked the time while this was open.
    const clashes = appointmentConflicts(appt, await eventStore.list(), await appointmentStore.list(), staff)
    if (clashes.length) { block(clashes.map((c) => c.message)); return }
    await appointmentStore.save(appt)
    finish()
    onCreated(slot.date)
  }
  const createMeeting = async () => {
    const event: CalendarEvent = {
      id: crypto.randomUUID(), title: name.trim(), type: 'meeting', date: when.date, time: when.time, endTime: addMin(when.time, minutes),
      attendees: attendees.roles, assignedTo: attendees.others || undefined,
      recurrence: repeat === 'none' ? undefined : repeat === 'weekly' ? { kind: 'weekly' } : { kind: 'monthly-nth', nth: defaultRecurrence(when.date).nth, weekday: defaultRecurrence(when.date).weekday },
    }
    const clashes = eventConflicts(event, await eventStore.list(), await appointmentStore.list(), staff, today())
    if (clashes.length) { block(clashes.map((c) => c.message)); return }
    await eventStore.save(event)
    finish()
    onCreated(when.date)
  }

  if (step === -1) {
    return (
      <div className="wizard-start">
        <button className="big-red" onClick={() => setStep(0)}>Schedule an Interview/Meeting</button>
      </div>
    )
  }

  return (
    <div className="card wizard">
      <div className="wizard-corner">
        <button onClick={finish}>Cancel</button>
        <span className="muted small">Step {step + 1} of {stepsFor}</span>
      </div>

      {step === 0 && (
        <>
          <p className="wizard-q">Is it an interview or a meeting?</p>
          <div className="choice-grid">
            <button className="primary" onClick={() => { setKind('interview'); setStep(1) }}>Interview</button>
            <button className="primary" onClick={() => { setKind('meeting'); setStep(1) }}>Meeting</button>
          </div>
        </>
      )}

      {step === 1 && (
        <form onSubmit={(ev) => { ev.preventDefault(); if (name.trim()) setStep(2) }}>
          <p className="wizard-q">{kind === 'interview' ? 'Who is the interview for?' : 'What is the meeting called?'}</p>
          {kind === 'interview' ? (
            <label>Ward member
              <NameSuggest autoFocus value={name} names={names} placeholder="Type a name" onChange={setName} />
            </label>
          ) : (
            <label>Title
              <input autoFocus value={name} placeholder="e.g. Ward Council" onChange={(ev) => setName(ev.target.value)} />
            </label>
          )}
          <div className="row actions">
            <button type="button" onClick={() => setStep(0)}>Back</button>
            <button type="submit" className="primary" disabled={!name.trim()}>Next</button>
          </div>
        </form>
      )}

      {step === 2 && (
        <>
          <p className="wizard-q">How long will {kind === 'interview' ? `it be with ${name.trim()}` : 'it be'}?</p>
          <div className="choice-grid">
            {LENGTHS.filter((m) => kind === 'meeting' || m <= 60).map((m) => (
              <button key={m} className={minutes === m ? 'primary' : ''} onClick={() => { setMinutes(m); setStep(3) }}>{m} min</button>
            ))}
            <button className={customLength ? 'primary' : ''} onClick={() => { setCustomLength(true); setMinutes(0) }}>Other</button>
          </div>
          {customLength && (
            <form className="row actions" onSubmit={(ev) => { ev.preventDefault(); if (minutes >= 5) setStep(3) }}>
              <label>Minutes
                <input type="number" inputMode="numeric" min={5} max={480} step={5} autoFocus value={minutes || ''} placeholder="e.g. 25" onChange={(ev) => setMinutes(Math.max(0, Math.min(480, Number(ev.target.value))))} />
              </label>
              <button type="submit" className="primary" disabled={minutes < 5}>Next</button>
            </form>
          )}
          <div className="row actions"><button onClick={() => setStep(1)}>Back</button></div>
        </>
      )}

      {step === 3 && kind === 'interview' && (
        <>
          <p className="wizard-q">Who will conduct the interview?</p>
          <div className="choice-grid">
            <button className="primary" onClick={() => { setWithWho('bishop'); setStep(4) }}>{label('bishop')}</button>
            <button className="primary" onClick={() => { setWithWho('counselor'); setStep(4) }}>A counselor</button>
          </div>
          <p className="muted small">A counselor means either {label('first-counselor')} or {label('second-counselor')}, whoever is free.</p>
          <div className="row actions"><button onClick={() => setStep(2)}>Back</button></div>
        </>
      )}

      {step === 4 && kind === 'interview' && (
        <>
          <p className="wizard-q">Pick a time for {name.trim()}</p>
          <p className="muted small">{minutes} min with {withWho === 'bishop' ? label('bishop') : 'a counselor'}</p>
          <SlotPicker minutes={minutes} roles={withWho === 'bishop' ? ['bishop'] : COUNSELORS} onPick={bookInterview} />
          <div className="row actions"><button onClick={() => setStep(3)}>Back</button></div>
        </>
      )}

      {step === 3 && kind === 'meeting' && (
        <>
          <p className="wizard-q">Who attends?</p>
          <AttendeePicker legend="Bishopric members" value={attendees} onChange={setAttendees} />
          <div className="row actions">
            <button onClick={() => setStep(2)}>Back</button>
            <button className="primary" disabled={!attendees.roles.length && !attendees.others.trim()} onClick={() => setStep(4)}>Next</button>
          </div>
        </>
      )}

      {step === 4 && kind === 'meeting' && (
        <>
          <p className="wizard-q">Does it repeat?</p>
          <div className="choice-grid">
            {([['none', 'Just once'], ['weekly', 'Every week'], ['monthly', 'Monthly, same weekday']] as [Repeat, string][]).map(([k, label]) => (
              <button key={k} className={repeat === k ? 'primary' : ''} onClick={() => setRepeat(k)}>{label}</button>
            ))}
          </div>
          <div className="row actions">
            <button onClick={() => setStep(3)}>Back</button>
            <button className="primary" onClick={() => setStep(5)}>Next</button>
          </div>
        </>
      )}

      {step === 5 && kind === 'meeting' && (
        <>
          <p className="wizard-q">When is it?</p>
          <label>Day<input type="date" value={when.date} onChange={(ev) => ev.target.value && setWhen({ ...when, date: ev.target.value })} /></label>
          <label>Start time<input type="time" value={when.time} onChange={(ev) => ev.target.value && setWhen({ ...when, time: ev.target.value })} /></label>
          <p className="muted small">{fmtTime(when.time)} to {fmtTime(addMin(when.time, minutes))}. If anyone is already booked then, it will say so.</p>
          <div className="row actions">
            <button onClick={() => setStep(4)}>Back</button>
            <button className="primary" onClick={createMeeting}>Create</button>
          </div>
        </>
      )}

      {dialog}
    </div>
  )
}
