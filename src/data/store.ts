import type {
  Appointment, CalendarEvent, CarryMark, CouncilAssignment, CouncilEntry, SpeakerExclusion, TeachingAssignment, FsyRef, Gathering, GratitudeAssignment, Individual, ListItem, Member,
  SacramentEntry, ScheduleEdit, ScheduleRow, Setting, StaffName, SundayNote, Youth,
} from './types'
import { cacheDrop, cachePut, cached, cloudEnabled, supabase } from './cloud'

// Data layer. Every page reads and writes through these stores, so it does not matter whether the data lives on
// this device (browserStore) or in the shared database (sharedStore).
export interface Store<T extends { id: string }> {
  list(): Promise<T[]>
  save(item: T): Promise<void>
  remove(id: string): Promise<void>
}

function browserStore<T extends { id: string }>(key: string): Store<T> {
  const read = (): T[] => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]')
    } catch {
      return []
    }
  }
  const write = (items: T[]) => localStorage.setItem(key, JSON.stringify(items))
  return {
    async list() {
      return read()
    },
    async save(item) {
      write([...read().filter((i) => i.id !== item.id), item])
    },
    async remove(id) {
      write(read().filter((i) => i.id !== id))
    },
  }
}

// The same list, kept in the shared database. Reads come from memory (filled after sign-in and updated live);
// a change is written to the database before the promise resolves, and the page's own copy updates at once.
function sharedStore<T extends { id: string }>(key: string): Store<T> {
  return {
    async list() {
      return cached<T>(key)
    },
    async save(item) {
      cachePut(key, item.id, item)
      const { error } = await supabase!.from('records').upsert({ store: key, id: item.id, data: item, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    async remove(id) {
      cacheDrop(key, id)
      const { error } = await supabase!.from('records').delete().eq('store', key).eq('id', id)
      if (error) throw error
    },
  }
}

// Shared when the app is set up with the database keys, otherwise this device only.
// Every list's storage key, so this device's own copy can be found and uploaded.
export const STORE_KEYS: string[] = []
const localStore = <T extends { id: string }>(key: string): Store<T> => {
  STORE_KEYS.push(key)
  return cloudEnabled ? sharedStore<T>(key) : browserStore<T>(key)
}

export const eventStore = localStore<CalendarEvent>('bishopric.events')
export const memberStore = localStore<Member>('bishopric.members')
export const sacramentStore = localStore<SacramentEntry>('bishopric.sacrament')
export const youthStore = localStore<Youth>('bishopric.youth')
export const fsyStore = localStore<FsyRef>('bishopric.fsy')
export const listStore = localStore<ListItem>('bishopric.lists')
export const scheduleStore = localStore<ScheduleRow>('bishopric.schedule')
export const scheduleEditStore = localStore<ScheduleEdit>('bishopric.scheduleEdits')
export const appointmentStore = localStore<Appointment>('bishopric.appointments')
export const gatheringStore = localStore<Gathering>('bishopric.gathering')
export const sundayStore = localStore<SundayNote>('bishopric.sundays')
export const staffStore = localStore<StaffName>('bishopric.staff')
export const settingStore = localStore<Setting>('bishopric.settings')
export const gratitudeStore = localStore<GratitudeAssignment>('bishopric.gratitude')
export const individualStore = localStore<Individual>('bishopric.individuals')
export const councilStore = localStore<CouncilEntry>('bishopric.council')
export const carryStore = localStore<CarryMark>('bishopric.carried')
export const speakerExclusionStore = localStore<SpeakerExclusion>('bishopric.speakerExclusions')
export const teachingStore = localStore<TeachingAssignment>('bishopric.teaching')
export const councilAssignmentStore = localStore<CouncilAssignment>('bishopric.councilAssignments')

// Every store by name, used for backup/restore and clearing data.
export const STORES: Record<string, Store<{ id: string }>> = {
  events: eventStore, members: memberStore, sacrament: sacramentStore,
  youth: youthStore, fsy: fsyStore, lists: listStore, schedule: scheduleStore, scheduleEdits: scheduleEditStore,
  appointments: appointmentStore, gathering: gatheringStore, sundays: sundayStore, staff: staffStore, settings: settingStore,
  gratitude: gratitudeStore, individuals: individualStore, council: councilStore, carried: carryStore, councilAssignments: councilAssignmentStore, teaching: teachingStore, speakerExclusions: speakerExclusionStore,
} as Record<string, Store<{ id: string }>>
