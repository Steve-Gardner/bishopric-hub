import { useState } from 'react'
import { format } from 'date-fns'
import { eventConflicts } from '../data/conflicts'
import { appointmentStore, eventStore, listStore } from '../data/store'
import { EVENT_TYPES, type CalendarEvent, type EventType, type RecurKind } from '../data/types'
import AttendeePicker from './AttendeePicker'
import { useStaff } from './useStaff'
import GroupPicker from './GroupPicker'
import { useBlocker } from './useBlocker'
import { NTH_LABELS, WEEKDAYS, defaultRecurrence } from '../data/recurrence'

interface Props {
  event: CalendarEvent
  exists: boolean // already saved, as opposed to a brand-new event
  occurrence: string | null // the date that was tapped, enabling "delete this one only"
  onClose: () => void
  onChanged: () => void
}

const dayOf = (iso: string) => new Date(iso + 'T00:00')

export default function EventSheet({ event, exists, occurrence, onClose, onChanged }: Props) {
  const { names } = useStaff()
  const { block, dialog } = useBlocker()
  const [draft, setDraft] = useState(event)
  const rec = draft.recurrence

  const done = () => { onClose(); onChanged() }
  const save = async () => {
    if (!draft.title.trim()) return
    // Never book someone who is already booked at that time (checked for every date a repeating event lands on).
    const clashes = eventConflicts(draft, await eventStore.list(), await appointmentStore.list(), names, format(new Date(), 'yyyy-MM-dd'))
    if (clashes.length) { block(clashes.map((c) => c.message)); return }
    await eventStore.save(draft)
    done()
  }
  const removeSeries = async () => {
    // Also drop the event's agenda checklist so it doesn't linger as orphaned data.
    const items = (await listStore.list()).filter((i) => i.list === `event:${draft.id}`)
    await Promise.all(items.map((i) => listStore.remove(i.id)))
    await eventStore.remove(draft.id)
    done()
  }
  const removeOne = async () => {
    if (!occurrence) return
    await eventStore.save({ ...draft, exceptions: [...(draft.exceptions ?? []), occurrence] })
    done()
  }

  const setKind = (value: string) => {
    if (value === 'none') {
      const { recurrence: _drop, exceptions: _skip, ...rest } = draft
      setDraft(rest)
    } else {
      const base = draft.recurrence ?? defaultRecurrence(draft.date)
      setDraft({ ...draft, recurrence: { ...defaultRecurrence(draft.date), ...base, kind: value as RecurKind } })
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); save() }}>
        <h2>{exists ? 'Edit event' : 'New event'}</h2>
        <label>Title
          <input autoFocus value={draft.title} onChange={(ev) => setDraft({ ...draft, title: ev.target.value })} />
        </label>
        <label>Type
          <select value={draft.type} onChange={(ev) => setDraft({ ...draft, type: ev.target.value as EventType })}>
            {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>{rec ? 'First day' : 'Date'}
          <input type="date" value={draft.date} onChange={(ev) => setDraft({ ...draft, date: ev.target.value })} />
        </label>
        <div className="row">
          <label>Start time
            <input type="time" value={draft.time ?? ''} onChange={(ev) => setDraft({ ...draft, time: ev.target.value || undefined })} />
          </label>
          <label>End time
            <input type="time" value={draft.endTime ?? ''} onChange={(ev) => setDraft({ ...draft, endTime: ev.target.value || undefined })} />
          </label>
        </div>

        <label>Location
          <input value={draft.location ?? ''} onChange={(ev) => setDraft({ ...draft, location: ev.target.value || undefined })} />
        </label>
        {draft.type === 'activity' && (
          <GroupPicker value={draft.youthGroups ?? []} onChange={(g) => setDraft({ ...draft, youthGroups: g.length ? g : undefined })} />
        )}

        <label>Repeats
          <select value={rec?.kind ?? 'none'} onChange={(ev) => setKind(ev.target.value)}>
            <option value="none">Does not repeat</option>
            <option value="weekly">Weekly</option>
            <option value="monthly-nth">Monthly, on a certain weekday (e.g. 2nd Tuesday)</option>
            <option value="monthly-date">Monthly, on the same date</option>
          </select>
        </label>
        {rec?.kind === 'weekly' && <p className="muted">Every {WEEKDAYS[dayOf(draft.date).getDay()]}.</p>}
        {rec?.kind === 'monthly-nth' && (
          <div className="row">
            <label>Which
              <select value={rec.nth} onChange={(ev) => setDraft({ ...draft, recurrence: { ...rec, nth: Number(ev.target.value) } })}>
                {Object.entries(NTH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Day
              <select value={rec.weekday} onChange={(ev) => setDraft({ ...draft, recurrence: { ...rec, weekday: Number(ev.target.value) } })}>
                {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
              </select>
            </label>
          </div>
        )}
        {rec?.kind === 'monthly-date' && (
          <p className="muted">On the {dayOf(draft.date).getDate()}th of each month (months without that day are skipped).</p>
        )}
        {rec && (
          <label>Repeat until (optional)
            <input type="date" value={rec.until ?? ''} onChange={(ev) => setDraft({ ...draft, recurrence: { ...rec, until: ev.target.value || undefined } })} />
          </label>
        )}

        <AttendeePicker
          value={{ roles: draft.attendees ?? [], others: draft.assignedTo ?? '' }}
          onChange={(a) => setDraft({ ...draft, attendees: a.roles.length ? a.roles : undefined, assignedTo: a.others || undefined })}
        />
        <label>Agenda
          <select value={draft.agenda ?? 'none'} onChange={(ev) => setDraft({ ...draft, agenda: ev.target.value === 'none' ? undefined : (ev.target.value as CalendarEvent['agenda']) })}>
            <option value="none">None</option>
            <option value="checklist">A simple checklist for this event</option>
            <option value="bishopric">The Bishopric Meeting agenda</option>
            <option value="council">The Ward Council agenda</option>
          </select>
        </label>
        <label>Notes
          <textarea rows={3} value={draft.notes ?? ''} onChange={(ev) => setDraft({ ...draft, notes: ev.target.value || undefined })} />
        </label>
        {rec && exists && <p className="muted">Changes apply to every occurrence in the series.</p>}
        <div className="row actions">
          <button type="submit" className="primary">Save</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
        {exists && (
          <div className="row actions">
            {rec && occurrence && <button type="button" className="danger" onClick={removeOne}>Delete {format(dayOf(occurrence), 'MMM d')} only</button>}
            <button type="button" className="danger" onClick={removeSeries}>{rec ? 'Delete series' : 'Delete'}</button>
          </div>
        )}
      </form>
      {dialog}
    </div>
  )
}
