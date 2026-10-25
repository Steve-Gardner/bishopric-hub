import { useCallback, useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { PRESIDENCY } from '../../data/people'
import GroupPicker from '../../components/GroupPicker'
import { fmtRange, nextSundayIso } from '../../data/format'
import { eventStore, listStore } from '../../data/store'
import AttendeePicker from '../../components/AttendeePicker'
import { DEFAULT_ACTIVITY_END_TIME, DEFAULT_ACTIVITY_LOCATION, DEFAULT_ACTIVITY_TIME, describeGroups, type CalendarEvent } from '../../data/types'

const blank = (date = nextSundayIso()): CalendarEvent => ({
  id: crypto.randomUUID(), title: '', type: 'activity', date, time: DEFAULT_ACTIVITY_TIME, endTime: DEFAULT_ACTIVITY_END_TIME, attendees: [...PRESIDENCY], location: DEFAULT_ACTIVITY_LOCATION, youthGroups: [],
})

// Add, edit and remove youth activities. They are calendar events (type Activity) that have youth groups ticked,
// so they also show on the Calendar, and the Youth tab lists them read-only.
// `initialDate` (from the Calendar's + Add menu) opens the new-activity form on that day.
export default function YouthActivitiesSetup({ initialDate, editId }: { initialDate?: string; editId?: string }) {
  const [items, setItems] = useState<CalendarEvent[]>([])
  const [editing, setEditing] = useState<CalendarEvent | null>(() => (initialDate ? blank(initialDate) : null))

  const reload = useCallback(
    () => eventStore.list().then((all) => setItems(all.filter((e) => e.youthGroups?.length).sort((a, b) => a.date.localeCompare(b.date)))),
    [],
  )
  useEffect(() => { reload() }, [reload])
  // A link from the Calendar can ask for one activity to be opened for changing.
  const opened = useRef('') // the link already acted on, so closing the form doesn't open it again
  useEffect(() => {
    const found = editId && opened.current !== editId ? items.find((i) => i.id === editId) : undefined
    if (found) { setEditing(found); opened.current = editId! }
  }, [editId, items])

  const exists = editing ? items.some((i) => i.id === editing.id) : false
  const valid = !!editing && !!editing.title.trim() && !!editing.date && !!editing.youthGroups?.length
  const save = async () => {
    if (!editing || !valid) return
    await eventStore.save({ ...editing, title: editing.title.trim(), location: editing.location?.trim() || undefined })
    setEditing(null)
    reload()
  }
  const remove = async () => {
    if (!editing) return
    const checklist = (await listStore.list()).filter((i) => i.list === `event:${editing.id}`)
    await Promise.all(checklist.map((i) => listStore.remove(i.id)))
    await eventStore.remove(editing.id)
    setEditing(null)
    reload()
  }

  return (
    <div className="fold-pad">
      <div className="row actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="muted" style={{ margin: 0 }}>Also shown on the Calendar, and read-only on the Youth tab.</p>
        <button className="primary" onClick={() => setEditing(blank())}>+ Add activity</button>
      </div>

      {items.length === 0 && <p className="muted">No activities yet.</p>}
      <ul className="plain">
        {items.map((a) => (
          <li key={a.id}>
            <span style={{ flex: 1 }}>
              <strong>{a.title}</strong>
              <br />
              <span className="muted">
                {[format(parseISO(a.date), 'EEE, MMM d, yyyy'), fmtRange(a.time, a.endTime), a.location, describeGroups(a.youthGroups ?? [])].filter(Boolean).join(' · ')}
              </span>
            </span>
            <button onClick={() => setEditing(a)} aria-label={`Edit ${a.title}`}>Edit</button>
          </li>
        ))}
      </ul>

      {editing && (
        <div className="modal" onClick={() => setEditing(null)}>
          <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); save() }}>
            <h2>{exists ? 'Edit activity' : 'New activity'}</h2>
            <label>Title
              <input autoFocus value={editing.title} onChange={(ev) => setEditing({ ...editing, title: ev.target.value })} />
            </label>
            <label>Date
              <input type="date" value={editing.date} onChange={(ev) => setEditing({ ...editing, date: ev.target.value })} />
            </label>
            <div className="row">
              <label>Start time
                <input type="time" value={editing.time ?? ''} onChange={(ev) => setEditing({ ...editing, time: ev.target.value || undefined })} />
              </label>
              <label>End time
                <input type="time" value={editing.endTime ?? ''} onChange={(ev) => setEditing({ ...editing, endTime: ev.target.value || undefined })} />
              </label>
            </div>
            <label>Location
              <input value={editing.location ?? ''} onChange={(ev) => setEditing({ ...editing, location: ev.target.value })} />
            </label>
            <AttendeePicker
              value={{ roles: editing.attendees ?? [], others: editing.assignedTo ?? '' }}
              onChange={(a) => setEditing({ ...editing, attendees: a.roles.length ? a.roles : undefined, assignedTo: a.others || undefined })}
            />
            <GroupPicker value={editing.youthGroups ?? []} onChange={(youthGroups) => setEditing({ ...editing, youthGroups })} />
            <div className="row">
              <button type="submit" className="primary" disabled={!valid}>Save</button>
              <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              {exists && <button type="button" className="danger" onClick={remove}>Delete</button>}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
