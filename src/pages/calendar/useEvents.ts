import { useCallback, useEffect, useState } from 'react'
import { eventStore } from '../../data/store'
import type { CalendarEvent } from '../../data/types'

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const reload = useCallback(() => eventStore.list().then(setEvents), [])
  useEffect(() => { reload() }, [reload])
  return { events, reload }
}
