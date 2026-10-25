import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import AutoTextarea from '../../components/AutoTextarea'
import ListEditor from '../../components/ListEditor'
import { fmtTime } from '../../data/format'
import { upcoming, type Occurrence } from '../../data/recurrence'
import { eventStore, gatheringStore } from '../../data/store'
import type { Gathering } from '../../data/types'

// Gathering One by One in Christ: who is being fellowshipped, their next ordinance, and the plan.
export function GatheringTable() {
  const [rows, setRows] = useState<Gathering[]>([])

  const reload = async () => setRows(await gatheringStore.list())
  useEffect(() => { reload() }, [])

  const patch = async (g: Gathering, p: Partial<Gathering>) => { await gatheringStore.save({ ...g, ...p }); reload() }
  const add = async () => { await gatheringStore.save({ id: crypto.randomUUID(), name: '', ordinance: '', plan: '' }); reload() }

  const cell = (g: Gathering, field: 'name' | 'ordinance' | 'plan', label: string) => (
    <td>
      <AutoTextarea
        aria-label={label}
        key={g.id + field + g[field]}
        defaultValue={g[field]}
        onBlur={(ev) => ev.target.value !== g[field] && patch(g, { [field]: ev.target.value })}
      />
    </td>
  )

  return (
    <>
      <div className="scroll">
        <table className="grid-table gather-table">
          <colgroup>
            <col className="col-name" />
            <col className="col-ordinance" />
            <col />
            <col className="col-remove" />
          </colgroup>
          <thead>
            <tr><th>Name</th><th>Next ordinance</th><th>Plan to love, share, invite</th><th aria-label="Remove" /></tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id}>
                {cell(g, 'name', 'Name')}
                {cell(g, 'ordinance', 'Next ordinance')}
                {cell(g, 'plan', 'Plan to love, share, invite')}
                <td><button className="danger" aria-label="Remove row" onClick={async () => { await gatheringStore.remove(g.id); reload() }}>✕</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted">No one yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <button onClick={add}>+ Add row</button>
    </>
  )
}

export function WardGoals({ onChange }: { onChange: () => void }) {
  return <ListEditor notes listKey="goals" placeholder="Add a goal" checkable tableLike onChange={onChange} />
}

// The bottom of the agenda: the next dates from the Calendar.
export default function WardTable({ bare }: { bare?: boolean }) { // bare: leave out the heading
  const [soon, setSoon] = useState<Occurrence[]>([])
  useEffect(() => {
    // Only events made as activities belong in this list.
    eventStore.list().then((all) => setSoon(upcoming(all.filter((e) => e.type === 'activity'), format(new Date(), 'yyyy-MM-dd'), 8)))
  }, [])

  return (
    <div className="ward-table">
      {!bare && <h2>Upcoming dates</h2>}
      <table className="grid-table">
        <thead><tr><th>Date</th><th>Event</th><th>Time</th></tr></thead>
        <tbody>
          {soon.map(({ event, date }) => (
            <tr key={event.id + date}>
              <td>{format(parseISO(date), 'EEE, MMM d')}</td>
              <td>{event.title}</td>
              <td>{fmtTime(event.time)}</td>
            </tr>
          ))}
          {soon.length === 0 && <tr><td colSpan={3} className="muted">Nothing upcoming.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
