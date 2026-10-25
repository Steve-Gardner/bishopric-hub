import { useCallback, useEffect, useState } from 'react'
import { addDays, format } from 'date-fns'
import { upcoming } from '../data/recurrence'
import { eventStore, gatheringStore, individualStore, listStore } from '../data/store'

// Number of things needing attention in each agenda section, for the red badges on collapsed sections.
// List keys count items not yet checked off. Special keys:
//   'gathering'       people in Gathering One by One in Christ
//   'individuals'     people on the Individual and Family Needs list
//   'council-individuals'  those of them shown on the Ward Council agenda
//   'upcoming-dates'  calendar events in the next two weeks
export function useAgendaCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({})

  const refresh = useCallback(async () => {
    const next: Record<string, number> = {}
    for (const item of await listStore.list()) if (!item.done) next[item.list] = (next[item.list] ?? 0) + 1

    next.gathering = (await gatheringStore.list()).length
    const people = await individualStore.list()
    next.individuals = people.length
    next['council-individuals'] = people.filter((p) => !p.hideFromCouncil).length
    const today = format(new Date(), 'yyyy-MM-dd')
    const end = format(addDays(new Date(), 14), 'yyyy-MM-dd')
    next['upcoming-dates'] = upcoming(await eventStore.list(), today, 40).filter((o) => o.date <= end).length
    setCounts(next)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  return { counts, refresh }
}
