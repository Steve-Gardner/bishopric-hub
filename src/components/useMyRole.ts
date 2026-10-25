import { useState } from 'react'
import { ROLES, type RoleKey } from '../data/roles'

const KEY = 'bishopric.myRole'

// Which role the person using this device holds. It is kept on the device, not in the shared data, since
// everyone uses their own phone. Until logins exist this is how the app knows, for example, that the bishop is
// the one looking at the Calendar.
export function readMyRole(): RoleKey | null {
  try {
    const saved = localStorage.getItem(KEY)
    return ROLES.some((r) => r.key === saved) ? (saved as RoleKey) : null
  } catch { return null }
}

export function useMyRole() {
  const [role, setRole] = useState<RoleKey | null>(readMyRole)
  const choose = (next: RoleKey | null) => {
    setRole(next)
    try { if (next) localStorage.setItem(KEY, next); else localStorage.removeItem(KEY) } catch { /* private mode */ }
  }
  return [role, choose] as const
}
