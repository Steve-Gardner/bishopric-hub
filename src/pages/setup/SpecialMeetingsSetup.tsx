import { useSpecialDates } from '../../components/useSpecialDates'
import { SPECIAL_SETTING } from '../../data/special'
import { settingStore } from '../../data/store'

const FIELDS: { id: string; label: string }[] = [
  { id: SPECIAL_SETTING.wardConference, label: 'Ward Conference' },
  { id: SPECIAL_SETTING.stakeConference1, label: 'Stake Conference (Spring)' },
  { id: SPECIAL_SETTING.easter, label: 'Easter' },
  { id: SPECIAL_SETTING.stakeConference2, label: 'Stake Conference (Fall)' },
  { id: SPECIAL_SETTING.primaryProgram, label: 'Primary Program' },
  { id: SPECIAL_SETTING.christmas, label: 'Christmas' },
]

// The dates of the special sacrament meetings. The Sacrament tab labels these Sundays with the event in
// capitals. Stake Conference (like General Conference) has no program to schedule.
export default function SpecialMeetingsSetup() {
  const { values, reload } = useSpecialDates()

  const save = async (id: string, value: string) => {
    if (value) await settingStore.save({ id, value })
    else await settingStore.remove(id)
    reload()
  }

  return (
    <>
      <p className="muted">
        Enter the date of each special meeting. The Sacrament tab shows the event next to that Sunday's date. General
        Conference is added automatically on the first Sunday of April and October.
      </p>
      <div className="special-dates">
        {FIELDS.map((f) => (
          <div key={f.id} className="special-row">
            <label>{f.label}
              <input type="date" value={values[f.id] ?? ''} onChange={(ev) => save(f.id, ev.target.value)} />
            </label>
            <button
              className="danger"
              onClick={() => save(f.id, '')}
              disabled={!values[f.id]}
              aria-label={`Clear ${f.label}`}
              title="Clear this date"
            >✕</button>
          </div>
        ))}
      </div>
    </>
  )
}
