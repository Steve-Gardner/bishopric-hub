import { useState } from 'react'
import AttendeePicker from '../../components/AttendeePicker'
import { everyone, type Attendees } from '../../data/attendees'
import { appointmentStore, eventStore } from '../../data/store'
import type { CalendarEvent } from '../../data/types'

const LENGTHS = [10, 15, 20, 30, 45, 60, 90]
type Kind = 'interview' | 'meeting'
type Repeat = 'none' | 'weekly' | 'monthly'

interface Props {
  names: string[] // ward members, suggested while typing an interview's name
  onCreated: () => void
  hasPending: boolean // something made here is still waiting to be placed on the schedule; the button comes back once it is
}

// A big red button starts it. First question: interview or meeting? An interview is with one member of the
// bishopric (decided by the column it is dropped in), so it only needs a name and a length. A meeting needs
// a title, a length, who attends (everyone to start with) and whether it repeats. Either way the result is a
// block that waits to be dragged onto the schedule, which sets the time (and, for an interview, who it is with).
export default function BookingWizard({ names, onCreated, hasPending }: Props) {
  const [step, setStep] = useState(-1) // -1: just the button
  const [kind, setKind] = useState<Kind>('interview')
  const [name, setName] = useState('') // the interview's person, or the meeting's title
  const [minutes, setMinutes] = useState(0)
  const [attendees, setAttendees] = useState<Attendees>(everyone)
  const [repeat, setRepeat] = useState<Repeat>('none')

  const stepsFor = kind === 'interview' ? 3 : 5 // kind, name, length (+ who attends, repeats)
  const finish = () => { setStep(-1); setName(''); setMinutes(0); setAttendees(everyone()); setRepeat('none') }

  const createInterview = async (len: number) => {
    await appointmentStore.save({ id: crypto.randomUUID(), date: '', leader: '', time: '', name: name.trim(), purpose: 'Interview', minutes: len })
    finish()
    onCreated()
  }
  const createMeeting = async () => {
    const event: CalendarEvent = {
      id: crypto.randomUUID(), title: name.trim(), type: 'meeting', date: '', minutes, attendees: attendees.roles, assignedTo: attendees.others || undefined,
      recurrence: repeat === 'none' ? undefined : { kind: repeat === 'weekly' ? 'weekly' : 'monthly-nth' },
    }
    await eventStore.save(event)
    finish()
    onCreated()
  }

  if (step === -1) {
    // While something made here waits to be placed, it shows in this spot instead of the button.
    if (hasPending) return null
    return (
      <div className="wizard-start">
        <button className="big-red" onClick={() => setStep(0)}>Schedule an Interview/Meeting</button>
      </div>
    )
  }

  return (
    <div className="card wizard">
      <div className="gratitude-title">
        <h2>Schedule a new {step === 0 ? 'interview or meeting' : kind}</h2>
        <span className="muted small" style={{ whiteSpace: 'nowrap' }}>Step {step + 1} of {stepsFor}</span>
      </div>

      {step === 0 && (
        <>
          <p className="wizard-q">Is it an interview or a meeting?</p>
          <div className="choice-grid">
            <button onClick={() => { setKind('interview'); setStep(1) }}>Interview</button>
            <button onClick={() => { setKind('meeting'); setStep(1) }}>Meeting</button>
          </div>
        </>
      )}

      {step === 1 && (
        <form onSubmit={(ev) => { ev.preventDefault(); if (name.trim()) setStep(2) }}>
          <p className="wizard-q">{kind === 'interview' ? 'Who is the interview for?' : 'What is the meeting called?'}</p>
          {kind === 'interview' ? (
            <label>Ward member
              <input autoFocus value={name} list="wizard-names" placeholder="Type a name" onChange={(ev) => setName(ev.target.value)} />
              <datalist id="wizard-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
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
              <button key={m} onClick={() => (kind === 'interview' ? createInterview(m) : (setMinutes(m), setStep(3)))}>{m} min</button>
            ))}
          </div>
          <div className="row actions"><button onClick={() => setStep(1)}>Back</button></div>
        </>
      )}

      {step === 3 && (
        <>
          <p className="wizard-q">Who attends?</p>
          <AttendeePicker legend="Bishopric members" value={attendees} onChange={setAttendees} />
          <div className="row actions">
            <button onClick={() => setStep(2)}>Back</button>
            <button className="primary" disabled={!attendees.roles.length && !attendees.others.trim()} onClick={() => setStep(4)}>Next</button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <p className="wizard-q">Does it repeat?</p>
          <div className="choice-grid">
            {([['none', 'Just once'], ['weekly', 'Every week'], ['monthly', 'Monthly, same weekday']] as [Repeat, string][]).map(([k, label]) => (
              <button key={k} className={repeat === k ? 'primary' : ''} onClick={() => setRepeat(k)}>{label}</button>
            ))}
          </div>
          <div className="row actions">
            <button onClick={() => setStep(3)}>Back</button>
            <button className="primary" onClick={createMeeting}>Create</button>
          </div>
        </>
      )}

      <div className="row actions"><button onClick={finish}>Cancel</button></div>
    </div>
  )
}
