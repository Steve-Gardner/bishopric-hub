import { useCallback, useEffect, useMemo, useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import Fold from '../../components/Fold'
import {
  PRAYER_ROLES, SPEAKING_ROLES, SPOKE_BUCKETS, lastNameKey, spokeBucket, youthByLastSpoke, type SpokeBucket,
} from '../../data/sacrament'
import { speakerExclusionStore } from '../../data/store'
import type { Member, Youth, SacramentEntry, SacramentRole, SpeakerExclusion } from '../../data/types'

const REASONS = ['Homebound', 'Health issues', 'Does not attend', 'Other']
const BAND_COLOR: Record<SpokeBucket, string> = { year: '#c0392b', 'two-years': '#e08a1e', older: '#d4b106' }

type Sort = 'date' | 'name'

interface Props {
  members: Member[]
  youth: Youth[]
  entries: SacramentEntry[]
}

// When each person last spoke or prayed, to help decide who to ask next. Adults can be narrowed by how long
// ago they spoke; the youth list always shows the whole Youth Roster. Every list sorts by date or last name.
export default function SpeakersSection({ members, youth, entries }: Props) {
  const [bucket, setBucket] = useState<SpokeBucket>('older')
  const [sort, setSort] = useState<Sort>('date')
  const [excluded, setExcluded] = useState<SpeakerExclusion[]>([])
  const [hiding, setHiding] = useState<string | null>(null)
  const loadExcluded = useCallback(() => speakerExclusionStore.list().then(setExcluded), [])
  useEffect(() => { loadExcluded() }, [loadExcluded])
  const excludedIds = useMemo(() => new Set(excluded.map((x) => x.id)), [excluded])
  const hide = async (id: string, reason: string) => {
    await speakerExclusionStore.save({ id, reason, date: format(new Date(), 'yyyy-MM-dd') })
    setHiding(null)
    loadExcluded()
  }
  const restore = async (id: string) => { await speakerExclusionStore.remove(id); loadExcluded() }
  const todayIso = format(new Date(), 'yyyy-MM-dd')

  // For each adult: the last time they spoke and the last time they prayed.
  const due = useMemo(() => {
    const today = new Date()
    const last = (id: string, roles: SacramentRole[]) =>
      entries.filter((e) => e.memberId === id && roles.includes(e.role)).map((e) => e.date).sort().at(-1)
    return members.map((m) => {
      const speak = last(m.id, SPEAKING_ROLES)
      const pray = last(m.id, PRAYER_ROLES)
      return {
        m, speak, pray,
        times: entries.filter((e) => e.memberId === m.id && SPEAKING_ROLES.includes(e.role)).length,
        speakDays: speak ? differenceInCalendarDays(today, parseISO(speak)) : Infinity,
        prayDays: pray ? differenceInCalendarDays(today, parseISO(pray)) : Infinity,
      }
    })
  }, [members, entries])
  // Visiting speakers (from outside the ward) are recorded by name only, so they are grouped by name here.
  const visitors = useMemo(() => {
    const byName = new Map<string, { name: string; affiliation?: string; last: string; times: number }>()
    for (const e of entries.filter((x) => x.role === 'speaker' && x.details?.name)) {
      const name = e.details!.name.trim()
      const cur = byName.get(name.toLowerCase())
      if (!cur) byName.set(name.toLowerCase(), { name, affiliation: e.details?.affiliation, last: e.date, times: 1 })
      else {
        cur.times++
        if (e.date > cur.last) { cur.last = e.date; cur.affiliation = e.details?.affiliation || cur.affiliation }
      }
    }
    return [...byName.values()].sort((a, b) => (a.last < b.last ? 1 : -1))
  }, [entries])
  const youthDue = useMemo(() => youthByLastSpoke(youth, entries, todayIso), [youth, entries, todayIso])

  // Prayers are given by anyone in the ward, so this list is the adults and the youth together.
  const prayerRows = useMemo(() => {
    const today = new Date()
    const row = (id: string, name: string, who: Pick<SacramentEntry, 'memberId' | 'youthId'>, tag?: string) => {
      const pray = entries
        .filter((e) => PRAYER_ROLES.includes(e.role) && (who.memberId ? e.memberId === who.memberId : e.youthId === who.youthId))
        .map((e) => e.date).sort().at(-1)
      return { id, name, tag, pray, prayDays: pray ? differenceInCalendarDays(today, parseISO(pray)) : Infinity }
    }
    return [
      ...members.map((m) => row(m.id, m.name, { memberId: m.id })),
      ...youth.map((y) => row(y.id, y.name, { youthId: y.id }, y.group === 'young-men' ? 'Young Man' : 'Young Woman')),
    ]
  }, [members, youth, entries])

  // Date: longest ago first, never asked at the top. Name: by last name.
  const byName = (a: string, b: string) => lastNameKey(a).localeCompare(lastNameKey(b))
  const ordered = <T,>(list: T[], name: (t: T) => string, days: (t: T) => number) =>
    [...list].sort((a, b) => (sort === 'name' ? byName(name(a), name(b)) : days(b) === days(a) ? byName(name(a), name(b)) : days(b) > days(a) ? 1 : -1))

  const ago = (iso?: string, days?: number) =>
    !iso ? 'Never' : `${format(parseISO(iso), 'MMM d, yyyy')} (${Math.round((days ?? 0) / 7)} wk ago)`

  const speakers = ordered(due.filter((r) => !excludedIds.has(r.m.id) && spokeBucket(r.speak, todayIso) === bucket), (r) => r.m.name, (r) => r.speakDays)
  const youthList = ordered(youthDue, (r) => r.youth.name, (r) => r.days)
  const prayers = ordered(prayerRows, (r) => r.name, (r) => r.prayDays)
  const countIn = (b: SpokeBucket) => due.filter((r) => !excludedIds.has(r.m.id) && spokeBucket(r.speak, todayIso) === b).length

  return (
    <>
      <div className="tabs sort-tabs" role="group" aria-label="Sort by">
        <span className="muted">Sort by</span>
        <button className={sort === 'date' ? 'primary' : ''} onClick={() => setSort('date')}>Date</button>
        <button className={sort === 'name' ? 'primary' : ''} onClick={() => setSort('name')}>Last name</button>
      </div>

      <Fold red id="speakers-adults" title="Adults" count={members.length}>
        <div className="fold-pad">
      {members.length === 0 ? (
        <p className="muted">Add ward members in <Link to="/setup?open=setup-ward-members">Setup</Link> first.</p>
      ) : (
        <>
          <div className="tabs">
            {SPOKE_BUCKETS.map((b) => (
              <button key={b.key} className={bucket === b.key ? 'primary' : ''} onClick={() => setBucket(b.key)}>
                {b.label} ({countIn(b.key)})
              </button>
            ))}
          </div>
          <p className="muted">When someone last spoke. Never asked counts as over 2 years. Green dot: never spoken. Yellow: 2+ years. Orange: 1-2 years. Red: within a year.</p>
          <ul className="plain">
            {speakers.map((r) => (
              <li key={r.m.id} style={{ flexWrap: 'wrap' }}>
                <span>
                  <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginRight: 8, background: !r.speak ? '#2e9e5b' : BAND_COLOR[spokeBucket(r.speak, todayIso)] }} />
                  <strong>{r.m.name}</strong> <span className="muted small">{r.times ? `${r.times}×` : 'never'}</span>
                </span>
                <span>
                  <span className={spokeBucket(r.speak, todayIso) === 'year' ? 'muted' : 'overdue'}>{ago(r.speak, r.speakDays)}</span>{' '}
                  <button className="linkish small" onClick={() => setHiding(hiding === r.m.id ? null : r.m.id)}>Hide</button>
                </span>
                {hiding === r.m.id && (
                  <span style={{ flexBasis: '100%' }} className="row actions">
                    <span className="muted small">Hide from this list because:</span>
                    {REASONS.map((x) => <button key={x} onClick={() => hide(r.m.id, x)}>{x}</button>)}
                  </span>
                )}
              </li>
            ))}
            {speakers.length === 0 && <li className="muted">No one in this group.</li>}
          </ul>
        </>
      )}
        </div>
      </Fold>

      {excluded.length > 0 && (
        <Fold red id="speakers-hidden" title="Hidden from the list" count={excluded.length}>
          <div className="fold-pad">
            <p className="muted">People who should not be asked to speak. Restore them when that changes.</p>
            <ul className="plain">
              {excluded.map((x) => (
                <li key={x.id}>
                  <span><strong>{members.find((m) => m.id === x.id)?.name ?? 'Unknown'}</strong> <span className="muted small">{x.reason}</span></span>
                  <button onClick={() => restore(x.id)}>Restore</button>
                </li>
              ))}
            </ul>
          </div>
        </Fold>
      )}

      <Fold red id="speakers-youth" title="Youth" count={youth.length}>
        <div className="fold-pad">
      {youth.length === 0 ? (
        <p className="muted">Add youth in the Youth Roster in <Link to="/setup?open=setup-youth-roster">Setup</Link> first.</p>
      ) : (
        <>
          <p className="muted">Everyone on the Youth Roster, and when they last spoke.</p>
          <ul className="plain">
            {youthList.map((r) => (
              <li key={r.youth.id}>
                <span><strong>{r.youth.name}</strong> <span className="muted small">{r.youth.group === 'young-men' ? 'Young Man' : 'Young Woman'}</span></span>
                <span className={spokeBucket(r.last, todayIso) === 'year' ? 'muted' : 'overdue'}>{ago(r.last, r.days)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
        </div>
      </Fold>

      {visitors.length > 0 && (
        <Fold red id="speakers-visitors" title="Visiting speakers" count={visitors.length}>
          <div className="fold-pad">
          <p className="muted">People from outside the ward who have spoken. They are not on the ward roster.</p>
          <ul className="plain">
            {visitors.map((v) => (
              <li key={v.name}>
                <span><strong>{v.name}</strong>{v.affiliation && <> <span className="muted small">{v.affiliation}</span></>}</span>
                <span className="muted">{format(parseISO(v.last), 'MMM d, yyyy')}{v.times > 1 ? ` (${v.times} times)` : ''}</span>
              </li>
            ))}
          </ul>
          </div>
        </Fold>
      )}

      {prayerRows.length > 0 && (
        <Fold red id="speakers-pray" title="Prayers" count={prayerRows.length}>
          <div className="fold-pad">
          <p className="muted">Everyone in the ward, adults and youth, and when they last prayed.</p>
          <ul className="plain">
            {prayers.map((r) => (
              <li key={r.id}>
                <span><strong>{r.name}</strong>{r.tag && <> <span className="muted small">{r.tag}</span></>}</span>
                <span className={spokeBucket(r.pray, todayIso) === 'year' ? 'muted' : 'overdue'}>{ago(r.pray, r.prayDays)}</span>
              </li>
            ))}
          </ul>
          </div>
        </Fold>
      )}
    </>
  )
}
