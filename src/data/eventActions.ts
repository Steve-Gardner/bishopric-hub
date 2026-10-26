import { eventStore, listStore } from './store'
import type { CalendarEvent } from './types'

// Delete a whole event, or every repeat of it. The event's agenda checklist goes too, so it does not linger.
export async function removeEventSeries(id: string): Promise<void> {
  const items = (await listStore.list()).filter((i) => i.list === `event:${id}`)
  await Promise.all(items.map((i) => listStore.remove(i.id)))
  await eventStore.remove(id)
}

// Delete one day of a repeating event; the other days stay.
export async function skipOccurrence(event: CalendarEvent, date: string): Promise<void> {
  await eventStore.save({ ...event, exceptions: [...(event.exceptions ?? []), date] })
}
