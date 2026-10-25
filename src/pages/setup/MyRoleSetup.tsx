import { useMyRole } from '../../components/useMyRole'
import { useStaff } from '../../components/useStaff'
import { memberLabel } from '../../data/memberFilter'
import { ROLES, type RoleKey } from '../../data/roles'

// Tells the app who is using this device. For now the only effect is on the Calendar: for the bishop it opens
// on his own schedule instead of everyone's.
export default function MyRoleSetup() {
  const [role, choose] = useMyRole()
  const { names } = useStaff()
  return (
    <>
      <label>On this device I am
        <select value={role ?? ''} onChange={(ev) => choose((ev.target.value || null) as RoleKey | null)}>
          <option value="">Not set</option>
          {ROLES.map((r) => <option key={r.key} value={r.key}>{memberLabel(r.key, names)}</option>)}
        </select>
      </label>
      <p className="muted small">Saved on this device only. If it is set to the Bishop, the Calendar opens showing just his schedule for the day. Everyone else sees everyone.</p>
    </>
  )
}
