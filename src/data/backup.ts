import { STORES } from './store'
import { clearAll } from './demo'

interface Backup {
  app: 'bishopric-hub'
  version: 1
  exportedAt: string
  data: Record<string, { id: string }[]>
}

export async function exportBackup(): Promise<string> {
  const data: Backup['data'] = {}
  for (const [name, store] of Object.entries(STORES)) data[name] = await store.list()
  const backup: Backup = { app: 'bishopric-hub', version: 1, exportedAt: new Date().toISOString(), data }
  return JSON.stringify(backup, null, 2)
}

// Throws a readable Error if the file is not a valid backup. Replaces all current data.
export async function importBackup(text: string): Promise<number> {
  let parsed: Backup
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (parsed?.app !== 'bishopric-hub' || typeof parsed.data !== 'object' || parsed.data === null) {
    throw new Error('That file is not a Bishopric Hub backup.')
  }
  // Validate everything before touching existing data.
  for (const [name, rows] of Object.entries(parsed.data)) {
    if (!(name in STORES)) continue
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r.id !== 'string')) {
      throw new Error(`The "${name}" section of the backup is damaged.`)
    }
  }
  await clearAll()
  let count = 0
  for (const [name, rows] of Object.entries(parsed.data)) {
    const store = STORES[name]
    if (!store) continue
    await Promise.all(rows.map((r) => store.save(r)))
    count += rows.length
  }
  return count
}
