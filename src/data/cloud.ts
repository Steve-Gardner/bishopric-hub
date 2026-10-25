import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'

// The shared database (Supabase). When the app has no keys (a plain local build) it falls back to this
// device's own storage, exactly as before.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const cloudEnabled = !!url && !!key
export const supabase: SupabaseClient | null = cloudEnabled ? createClient(url!, key!) : null

type Row = { store: string; id: string; data: unknown }

// Every record, by list, held in memory so pages can read them straight away. Filled once after sign-in and
// kept up to date by live changes from other phones.
const cache = new Map<string, Map<string, unknown>>()
const bucket = (store: string) => {
  let b = cache.get(store)
  if (!b) cache.set(store, (b = new Map()))
  return b
}

export const cached = <T,>(store: string): T[] => [...(cache.get(store)?.values() ?? [])] as T[]
export const cachePut = (store: string, id: string, data: unknown) => { bucket(store).set(id, data) }
export const cacheDrop = (store: string, id: string) => { bucket(store).delete(id) }

// Bumps when another phone changes something, so the open page can load again.
let version = 0
const listeners = new Set<() => void>()
const bump = () => { version++; listeners.forEach((l) => l()) }
export const useDataVersion = () =>
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => version)

// Load everything the signed-in person is allowed to see.
export async function loadAll(): Promise<void> {
  if (!supabase) return
  cache.clear()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('records').select('store,id,data').range(from, from + 999)
    if (error) throw error
    for (const r of (data ?? []) as Row[]) bucket(r.store).set(r.id, r.data)
    if (!data || data.length < 1000) break
  }
}

// Watch for changes made on other phones. A change that arrives while someone is typing waits until they stop,
// so a page never reloads out from under them.
export function watchChanges(): () => void {
  if (!supabase) return () => undefined
  let timer: number | undefined
  const refresh = () => {
    window.clearTimeout(timer)
    const busy = () => !!document.querySelector('.modal') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')
    const tryNow = () => { if (busy()) timer = window.setTimeout(tryNow, 1500); else bump() }
    timer = window.setTimeout(tryNow, 300)
  }
  const channel = supabase
    .channel('records')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, (payload) => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<Row>
      if (!row.store || !row.id) return
      if (payload.eventType === 'DELETE') cacheDrop(row.store, row.id)
      else cachePut(row.store, row.id, (row as Row).data)
      refresh()
    })
    .subscribe()
  return () => { window.clearTimeout(timer); supabase!.removeChannel(channel) }
}
