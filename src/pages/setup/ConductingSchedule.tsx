import { useEffect, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns'
import { defaultPlan, resetSunday, setSunday, sundayPlan, type Names } from '../../data/conducting'
import { staffStore, sundayStore } from '../../data/store'
import type { SundayNote } from '../../data/types'

const ordinal = (n: number) => ['1st', '2nd', '3rd', '4th', '5th'][n - 1]

// Who conducts each Sunday, and a note for it. The schedule fills itself in from the rules; anything
// typed here replaces that Sunday's default.
export default function ConductingSchedule() {
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [names, setNames] = useState<Names>({})
  const [stored, setStored] = useState<SundayNote[]>([])

  const reload = async () => {
    setNames(Object.fromEntries((await staffStore.list()).map((s) => [s.id, s.name])))
    setStored(await sundayStore.list())
  }
  useEffect(() => { reload() }, [])

  const sundays = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).filter((d) => d.getDay() === 0)

  return (
    <>
      <p className="muted">
        Fills in automatically: the 1st Sunday (Fast Sunday) rotates Bishop, 1st Counselor, 2nd Counselor through each
        quarter; then 1st Counselor, Bishop, and 2nd Counselor on the 2nd, 3rd, and 4th Sundays. In April and October,
        General Conference takes the 1st Sunday and Fast Sunday moves to the 2nd. Names come from the Roles section.
      </p>

      <div className="cal-head">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">‹</button>
        <h2>{format(month, 'MMMM yyyy')}</h2>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">›</button>
      </div>

      <ul className="plain">
        {sundays.map((d, i) => {
          const iso = format(d, 'yyyy-MM-dd')
          const row = stored.find((n) => n.id === iso)
          const plan = sundayPlan(iso, row, names)
          return (
            <li key={iso + plan.conducting + plan.note} className="cond-row">
              <strong>{format(d, 'MMM d')} <span className="muted">{ordinal(i + 1)}</span></strong>
              <input
                defaultValue={plan.conducting}
                placeholder={defaultPlan(iso).role ? '' : 'No one conducting'}
                aria-label={`Conducting on ${format(d, 'MMM d')}`}
                onBlur={async (ev) => { if (ev.target.value.trim() !== plan.conducting) { await setSunday(iso, { conducting: ev.target.value }, names); reload() } }}
              />
              <input
                defaultValue={plan.note}
                placeholder="Note"
                aria-label={`Note for ${format(d, 'MMM d')}`}
                onBlur={async (ev) => { if (ev.target.value.trim() !== plan.note) { await setSunday(iso, { note: ev.target.value }, names); reload() } }}
              />
              {plan.overridden
                ? <button onClick={async () => { await resetSunday(iso); reload() }} aria-label={`Reset ${format(d, 'MMM d')} to the default`} title="Reset to the default">↺</button>
                : <span />}
            </li>
          )
        })}
      </ul>
    </>
  )
}
