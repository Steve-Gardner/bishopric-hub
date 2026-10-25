import type { Attendees } from '../data/attendees'
import { PRESIDENCY } from '../data/people'
import { ROLES } from '../data/roles'
import { useStaff } from './useStaff'

interface Props {
  value: Attendees
  onChange: (value: Attendees) => void
  legend?: string
}

// Who attends a meeting: a checkbox each for the bishop and his counselors, and a box for anyone else.
export default function AttendeePicker({ value, onChange, legend = 'Who attends' }: Props) {
  const { names } = useStaff()
  const toggle = (role: (typeof PRESIDENCY)[number], on: boolean) =>
    onChange({ ...value, roles: PRESIDENCY.filter((r) => (r === role ? on : value.roles.includes(r))) })

  return (
    <fieldset className="attendees">
      <legend>{legend}</legend>
      <div className="attendee-boxes">
        {PRESIDENCY.map((role) => (
          <label key={role} className="check-row">
            <input type="checkbox" checked={value.roles.includes(role)} onChange={(ev) => toggle(role, ev.target.checked)} />
            {names[role]?.trim() || ROLES.find((r) => r.key === role)?.label}
          </label>
        ))}
      </div>
      <label>Others (optional)
        <input value={value.others} placeholder="e.g. Ward Clerk, Primary Presidency" onChange={(ev) => onChange({ ...value, others: ev.target.value })} />
      </label>
    </fieldset>
  )
}
