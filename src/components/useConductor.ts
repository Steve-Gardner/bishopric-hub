import { useEffect, useState } from 'react'
import { sundayPlan } from '../data/conducting'
import { staffStore, sundayStore } from '../data/store'

// Who conducts on a given Sunday, from the Conducting Schedule on the Schedule tab. Empty when no one does
// (for example General Conference Sunday).
export function useConductor(date: string): string {
  const [name, setName] = useState('')
  useEffect(() => {
    let alive = true
    Promise.all([staffStore.list(), sundayStore.list()]).then(([staff, sundays]) => {
      if (!alive) return
      const names = Object.fromEntries(staff.map((s) => [s.id, s.name]))
      setName(sundayPlan(date, sundays.find((n) => n.id === date), names).conducting)
    })
    return () => { alive = false }
  }, [date])
  return name
}
