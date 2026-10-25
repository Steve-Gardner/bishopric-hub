import { useStaff } from '../../components/useStaff'
import { ROLES } from '../../data/roles'
import { staffStore } from '../../data/store'

// Who holds each role. Type a name for each one; the rest of the app reads these names whenever it needs
// to know who is who (the Conducting Schedule, assignments, appointments, and name suggestions).
export default function RolesSetup() {
  const { names, reload } = useStaff()

  const save = async (role: string, value: string) => {
    if (value.trim()) await staffStore.save({ id: role, name: value.trim() })
    else await staffStore.remove(role)
    reload()
  }

  return (
    <>
      <p className="muted">
        Type the name of whoever holds each role. These names are used everywhere the app asks who someone is.
      </p>
      <div className="staff-names">
        {ROLES.map((r) => (
          <label key={r.key}>{r.label}
            <input
              key={r.key + (names[r.key] ?? '')}
              defaultValue={names[r.key] ?? ''}
              placeholder="Name"
              onBlur={(ev) => ev.target.value.trim() !== (names[r.key] ?? '') && save(r.key, ev.target.value)}
            />
          </label>
        ))}
      </div>
    </>
  )
}
