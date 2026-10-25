import { loadAll, supabase } from './cloud'
import { STORE_KEYS } from './store'

// What this device has saved in its own storage, by list.
function deviceData(): Record<string, { id: string }[]> {
  const out: Record<string, { id: string }[]> = {}
  for (const key of STORE_KEYS) {
    try {
      const rows = JSON.parse(localStorage.getItem(key) ?? '[]')
      if (Array.isArray(rows) && rows.length) out[key] = rows
    } catch { /* skip a damaged list */ }
  }
  return out
}

export const deviceRecordCount = (): number => Object.values(deviceData()).reduce((n, rows) => n + rows.length, 0)

// Copy this device's own data into the shared database (existing records with the same id are replaced).
export async function uploadDeviceData(): Promise<number> {
  if (!supabase) return 0
  const rows = Object.entries(deviceData()).flatMap(([store, items]) =>
    items.map((data) => ({ store, id: data.id, data, updated_at: new Date().toISOString() })))
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('records').upsert(rows.slice(i, i + 200))
    if (error) throw error
  }
  await loadAll()
  return rows.length
}
