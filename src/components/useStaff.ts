import { useCallback, useEffect, useState } from 'react'
import type { Names } from '../data/conducting'
import { ROLES } from '../data/roles'
import { staffStore } from '../data/store'

// The names of whoever holds each role, entered in Setup. This is the one place the app looks
// up who is who, so the Conducting Schedule, name suggestions, and assignments all agree.
export function useStaff() {
  const [names, setNames] = useState<Names>({})
  const reload = useCallback(
    async () => setNames(Object.fromEntries((await staffStore.list()).map((s) => [s.id, s.name]))),
    [],
  )
  useEffect(() => { reload() }, [reload])
  return { names, reload }
}

// One suggestion per role: the person's name, or the role's title until a name has been entered.
export const staffSuggestions = (names: Names): string[] => ROLES.map((r) => names[r.key]?.trim() || r.label)
