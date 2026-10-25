import { ACTIVITY_GROUPS, type ActivityGroup } from '../data/types'

interface Props {
  value: ActivityGroup[]
  onChange: (next: ActivityGroup[]) => void
}

// Checkboxes for who a youth activity is for: All Combined, then the young men and young women groups.
export default function GroupPicker({ value, onChange }: Props) {
  const toggle = (key: ActivityGroup) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])

  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 10px' }}>
      <legend className="muted" style={{ padding: 0, marginBottom: 4 }}>Who is it for?</legend>
      {ACTIVITY_GROUPS.map((g, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          {g.label && <div className="muted" style={{ fontWeight: 700, margin: '6px 0 2px' }}>{g.label}</div>}
          {g.options.map((o) => (
            <label key={o.key} className="check-row" style={{ marginBottom: 4 }}>
              <input type="checkbox" checked={value.includes(o.key)} onChange={() => toggle(o.key)} />
              {o.label}
            </label>
          ))}
        </div>
      ))}
    </fieldset>
  )
}
