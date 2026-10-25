import { carryStore, listStore } from './store'

interface Options {
  type: string // which agenda, e.g. 'bishopric' or 'council'
  keys: string[] // list keys whose unfinished items move forward (without the @date part)
  date: string // the meeting being opened
  prevOf: (date: string) => string // the meeting before a given one
  today: string // yyyy-MM-dd
}

// Runs one at a time, and a second request for the same meeting shares the run already in progress.
// Without this, two overlapping runs (React runs effects twice in development, and people tap the
// arrows quickly) would both copy the same items.
let queue: Promise<unknown> = Promise.resolve()
const inFlight = new Map<string, Promise<number>>()

// Copies the previous meeting's unfinished items into this meeting, once. If meetings in between were
// never opened, the items chain through them so nothing is skipped. Meetings in the past are left alone.
// Resolves to how many items were added to the opened meeting.
export function carryForward(options: Options): Promise<number> {
  const id = `${options.type}:${options.date}`
  const running = inFlight.get(id)
  if (running) return running

  const run = queue.then(() => carry(options))
  queue = run.catch(() => undefined)
  inFlight.set(id, run)
  const done = () => { inFlight.delete(id) }
  run.then(done, done)
  return run
}

async function carry({ type, keys, date, prevOf, today }: Options): Promise<number> {
  if (date < today) return 0

  const marked = new Set((await carryStore.list()).map((m) => m.id))
  const chain: string[] = []
  let source = date
  for (let i = 0; i < 26 && source >= today && !marked.has(`${type}:${source}`); i++) {
    chain.unshift(source)
    source = prevOf(source)
  }

  let addedToOpened = 0
  for (const target of chain) {
    const all = await listStore.list()
    let added = 0
    for (const key of keys) {
      const open = all.filter((i) => i.list === `${key}@${source}` && !i.done).sort((a, b) => a.order - b.order)
      const here = all.filter((i) => i.list === `${key}@${target}`)
      const have = new Set(here.map((i) => i.text))
      let order = here.length ? Math.max(...here.map((i) => i.order)) + 1 : 0
      for (const item of open) {
        if (have.has(item.text)) continue
        have.add(item.text) // never add the same item twice, even if the source repeats it
        await listStore.save({ id: crypto.randomUUID(), list: `${key}@${target}`, text: item.text, notes: item.notes, order: order++, done: false })
        added++
      }
    }
    await carryStore.save({ id: `${type}:${target}` })
    if (target === date) addedToOpened = added
    source = target
  }
  return addedToOpened
}
