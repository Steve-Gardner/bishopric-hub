// Matching a typed name to the ward roster, treating common nicknames as the same first name
// (Steve = Steven, Bill = William) so a speaker is not added a second time under a different spelling.
const NICK: Record<string, string> = {
  steve: 'steven', bill: 'william', will: 'william', dave: 'david', jim: 'james', jimmy: 'james', mike: 'michael', tom: 'thomas',
  ken: 'kenneth', rich: 'richard', rick: 'richard', dick: 'richard', chuck: 'charles', jeff: 'jeffrey', josh: 'joshua', dan: 'daniel',
  ron: 'ronald', don: 'donald', liz: 'elizabeth', lizzy: 'elizabeth', beth: 'elizabeth', kam: 'kamryn', kate: 'katherine', katie: 'katherine',
  jenn: 'jennifer', jen: 'jennifer', pat: 'patricia', zac: 'zachary', zak: 'zachary', alex: 'alexander', sam: 'samuel', ben: 'benjamin',
  matt: 'matthew', nate: 'nathaniel', abbi: 'abigail', abby: 'abigail', sara: 'sarah', syd: 'sydney', jake: 'jacob', cory: 'corey',
  tim: 'timothy', andy: 'andrew', drew: 'andrew', greg: 'gregory', joe: 'joseph', tony: 'anthony', chris: 'christopher', ed: 'edward', ted: 'edward',
}
const clean = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean)
const canon = (first: string) => NICK[first] ?? first

// The roster entry for a typed name: the exact name first, otherwise the one person whose last name matches
// and whose first name is the same or a nickname of it. Returns undefined when nothing, or more than one, fits.
export function findByName<T extends { name: string }>(list: T[], typed: string): T | undefined {
  const exact = list.find((x) => x.name.toLowerCase() === typed.trim().toLowerCase())
  if (exact) return exact
  const t = clean(typed)
  if (t.length < 2) return undefined
  const first = canon(t[0]), last = t[t.length - 1]
  const hits = list.filter((x) => {
    const n = clean(x.name)
    return n.length >= 2 && n[n.length - 1] === last && canon(n[0]) === first
  })
  return hits.length === 1 ? hits[0] : undefined
}
