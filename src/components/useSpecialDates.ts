import { useCallback, useEffect, useState } from 'react'
import type { SpecialValues } from '../data/special'
import { settingStore } from '../data/store'

// The special sacrament meeting dates entered in Schedule, keyed by setting id.
export function useSpecialDates() {
  const [values, setValues] = useState<SpecialValues>({})
  const reload = useCallback(async () => {
    const all = await settingStore.list()
    setValues(Object.fromEntries(all.filter((s) => s.id.startsWith('special.')).map((s) => [s.id, s.value])))
  }, [])
  useEffect(() => { reload() }, [reload])
  return { values, reload }
}
