import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import AutoTextarea from '../../components/AutoTextarea'
import PencilIcon from '../../components/PencilIcon'
import ReorderList from '../../components/ReorderList'
import { ROLES } from '../../data/roles'
import { ROLE_LABEL, describeEntry, nextOrder, sortEntries, youthByLastSpoke } from '../../data/sacrament'
import { conflictFor, lookupPerson, placeEntry, resolvePerson, type Who } from '../../data/sacramentPeople'
import { HIGH_COUNCILOR, POSITIONS, STAKE_LEADERS, TITLES, YOUTH_SPEAKER, buildScript, emptyVisitor, defaultAnswers, defaultTitle, type Block, type HymnAnswer, type ScriptAnswers, type Visitor } from '../../data/script'
import { listStore, sacramentStore, settingStore } from '../../data/store'
import type { Member, SacramentEntry, SacramentRole, Youth } from '../../data/types'

interface Props {
  date: string
  entries: SacramentEntry[]
  members: Member[]
  youth: Youth[]
  conducting: string // from the Conducting Schedule
  leaders: string[] // the bishop and his counselors, as named in Roles
  onConducting: (name: string) => void // writes the choice back to the Conducting Schedule
  onChange: () => void // after the program changes (a musical number added or moved), so it can be read again
  onClose: () => void
}

const answersKey = (date: string) => `script:${date}`
const manualKey = (date: string) => `script:${date}:edited`

// Anything in [square brackets] is something still to be filled in; show it so it can't be missed.
function Marked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\]|_{3,})/g).map((part, i) =>
        /^(\[[^\]]+\]|_{3,})$/.test(part) ? <mark key={i} className={part.startsWith('_') ? 'script-gap script-blank' : 'script-gap'}>{part}</mark> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  )
}

// The conducting script for one Sunday: a short wizard for what the program doesn't already say, and the
// finished script below it, ready to print or save as a PDF.
export default function ScriptSheet({ date, entries, members, youth, conducting, leaders, onConducting, onChange, onClose }: Props) {
  const [answers, setAnswers] = useState<ScriptAnswers | null>(null)
  type Pulled = { announcements: string; releases: string; sustainings: string }
  // This Sunday's Sacrament Announcements, Releases and Sustainings on the Bishopric Agenda
  const [agenda, setAgenda] = useState<Pulled>({ announcements: '', releases: '', sustainings: '' })
  const loaded = useRef(false)
  const [musicType, setMusicType] = useState<'musical' | 'choir'>('musical')
  const [music, setMusic] = useState({ performers: '', title: '' })
  const [addingMusic, setAddingMusic] = useState(false)
  // Adding, swapping or removing a speaker or prayer here changes the Sacrament program itself.
  const [addingPart, setAddingPart] = useState(false)
  const [partKind, setPartKind] = useState<SacramentRole>('youth-speaker')
  const [part, setPart] = useState({ name: '', youth: '', affiliation: '' })
  const [partError, setPartError] = useState('')
  const [changing, setChanging] = useState<string | null>(null)
  const [changeTo, setChangeTo] = useState('')
  // The script as edited by hand for this Sunday only; null while it still follows Meeting Setup.
  const [manual, setManual] = useState<Block[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [pane, setPane] = useState<'form' | 'script'>('form') // which half shows on a narrow screen; wide screens show both

  useEffect(() => {
    let alive = true
    Promise.all([settingStore.list(), listStore.list()]).then(([all, lists]) => {
      if (!alive) return
      const pull = (key: string) =>
        lists.filter((i) => i.list === `${key}@${date}`).sort((a, b) => a.order - b.order)
          .map((i) => [i.text, i.notes?.replace(/\s*\n\s*/g, ' ').trim()].filter(Boolean).join(': ')).join('\n')
      setAgenda({ announcements: pull('agenda:announcements'), releases: pull('agenda:releases'), sustainings: pull('agenda:sustainings') })
      const byId = Object.fromEntries(all.map((s) => [s.id, s.value]))
      let saved: Partial<ScriptAnswers> = {}
      try { saved = JSON.parse(byId[answersKey(date)] ?? '{}') } catch { /* start fresh */ }
      const base = defaultAnswers(entries, saved)
      try { setManual(byId[manualKey(date)] ? (JSON.parse(byId[manualKey(date)]) as Block[]) : null) } catch { /* ignore */ }
      setAnswers(base)
      loaded.current = true
    })
    return () => { alive = false }
    // The entries are only used to suggest hymns the first time; later edits are the person's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // Remember what was typed for this Sunday.
  useEffect(() => {
    if (!answers || !loaded.current) return
    const t = setTimeout(() => {
      settingStore.save({ id: answersKey(date), value: JSON.stringify(answers) })
    }, 400)
    return () => clearTimeout(t)
  }, [answers, date])

  const manualLoaded = useRef(false)
  useEffect(() => {
    if (!loaded.current) return
    if (!manualLoaded.current) { manualLoaded.current = true; return }
    const t = setTimeout(() => {
      if (manual) settingStore.save({ id: manualKey(date), value: JSON.stringify(manual) })
      else settingStore.remove(manualKey(date))
    }, 400)
    return () => clearTimeout(t)
  }, [manual, date])

  const sorted = useMemo(() => sortEntries(entries), [entries])
  const named = useMemo(() => {
    const people: Record<string, { entry: SacramentEntry; name: string; group?: 'young-men' | 'young-women' }> = {}
    for (const e of sorted) {
      const y = e.youthId ? youth.find((x) => x.id === e.youthId) : undefined
      const name = y?.name ?? members.find((m) => m.id === e.memberId)?.name ?? e.details?.name ?? ''
      if (['invocation', 'benediction', 'youth-speaker', 'adult-speaker', 'speaker'].includes(e.role)) people[e.id] = { entry: e, name, group: y?.group }
    }
    return people
  }, [sorted, youth, members])

  if (!answers) return null

  // Musical numbers and speakers can be put in any order; prayers stay first and last.
  const movable = sorted.filter((e) => ['youth-speaker', 'adult-speaker', 'speaker', 'musical', 'choir'].includes(e.role))
  const opening = sorted.find((e) => e.role === 'invocation')
  const closing = sorted.find((e) => e.role === 'benediction')
  const canAddMusic = music.title.trim() !== '' || (musicType === 'musical' && music.performers.trim() !== '')
  const addMusic = async () => {
    if (!canAddMusic) return
    const details: Record<string, string> = {}
    if (music.title.trim()) details.title = music.title.trim()
    if (music.performers.trim()) details[musicType === 'choir' ? 'director' : 'performers'] = music.performers.trim()
    await sacramentStore.save({ id: crypto.randomUUID(), date, role: musicType, order: nextOrder(entries), details })
    setMusic({ performers: '', title: '' })
    setAddingMusic(false)
    onChange()
  }
  const removeEntry = async (e: SacramentEntry) => { await sacramentStore.remove(e.id); onChange() }
  // Dropping a row somewhere new: the speakers and musical numbers take the places they already held, in the new order.
  const reorder = async (ids: string[]) => {
    const slots = sorted.map((e, i) => (movable.includes(e) ? i : -1)).filter((i) => i >= 0)
    const all = [...sorted]
    ids.forEach((id, n) => { all[slots[n]] = sorted.find((e) => e.id === id)! })
    await Promise.all(all.map((x, n) => sacramentStore.save({ ...x, order: n })))
    onChange()
  }
  const nameOfWho = (who: Who) => (who.memberId ? members.find((m) => m.id === who.memberId)?.name : youth.find((y) => y.id === who.youthId)?.name) ?? 'That person'
  const taken = (who: Who, ignoreId?: string) => {
    const other = conflictFor(entries, who, ignoreId)
    return other ? `${nameOfWho(who)} is already on the program as ${ROLE_LABEL[other.role]}.` : ''
  }
  const forgetTitle = (id: string) => {
    const { [id]: _gone, ...rest } = answers.titles
    return rest
  }
  const addPartEntry = async () => {
    const name = part.name.trim()
    const entry: SacramentEntry = { id: crypto.randomUUID(), date, role: partKind }
    if (partKind === 'youth-speaker') {
      if (!part.youth) { setPartError('Choose a youth.'); return }
      const clash = taken({ youthId: part.youth })
      if (clash) { setPartError(clash); return }
      entry.youthId = part.youth
    } else if (partKind === 'speaker') {
      if (!name) { setPartError('Enter a name.'); return }
      entry.details = { name, ...(part.affiliation.trim() ? { affiliation: part.affiliation.trim() } : {}) }
    } else {
      if (!name) { setPartError('Enter a name.'); return }
      const known = lookupPerson(partKind, name, members, youth)
      const clash = known ? taken(known) : ''
      if (clash) { setPartError(clash); return }
      const who = await resolvePerson(partKind, name, members, youth)
      if (who.memberId) entry.memberId = who.memberId
      if (who.youthId) entry.youthId = who.youthId
    }
    await Promise.all(placeEntry(sorted, entry).map((x) => sacramentStore.save(x)))
    setAddingPart(false)
    setPart({ name: '', youth: '', affiliation: '' })
    setPartError('')
    onChange()
  }
  const changePerson = async (e: SacramentEntry) => {
    const value = changeTo.trim()
    if (!value) { setPartError('Choose or enter someone.'); return }
    let next: SacramentEntry
    if (e.role === 'youth-speaker') {
      const clash = taken({ youthId: value }, e.id)
      if (clash) { setPartError(clash); return }
      next = { ...e, youthId: value }
    } else if (e.role === 'speaker') {
      next = { ...e, details: { ...e.details, name: value } }
    } else {
      const known = lookupPerson(e.role, value, members, youth)
      const clash = known ? taken(known, e.id) : ''
      if (clash) { setPartError(clash); return }
      const who = await resolvePerson(e.role, value, members, youth)
      next = { ...e, memberId: who.memberId, youthId: who.youthId }
    }
    await sacramentStore.save(next)
    setAnswers({ ...answers, titles: forgetTitle(e.id) }) // a new person needs a title of their own
    setChanging(null)
    setPartError('')
    onChange()
  }
  const removePart = async (e: SacramentEntry) => {
    await sacramentStore.remove(e.id)
    setAnswers({ ...answers, titles: forgetTitle(e.id) })
    onChange()
  }
  const set = <K extends keyof ScriptAnswers>(k: K, v: ScriptAnswers[K]) => setAnswers({ ...answers, [k]: v })
  const merged = {
    announcements: answers.announcements ?? agenda.announcements,
    releases: answers.releases ?? agenda.releases,
    sustainings: answers.sustainings ?? agenda.sustainings,
  }
  // A list that comes from the agenda: shows the agenda's items until it is edited here.
  const pulled = (k: keyof Pulled, label: string, hint: string) => (
    <>
      <label>{label}
        <textarea rows={3} value={merged[k]} placeholder={hint} onChange={(ev) => set(k, ev.target.value)} />
      </label>
      {answers[k] !== undefined && answers[k] !== agenda[k] && (
        <button type="button" className="link-btn" onClick={() => setAnswers({ ...answers, [k]: undefined })}>Use the agenda’s list again</button>
      )}
    </>
  )
  const text = (k: keyof ScriptAnswers, label: string, hint?: string) => (
    <label>{label}<input value={answers[k] as string} placeholder={hint} onChange={(ev) => set(k, ev.target.value as never)} /></label>
  )
  const hymn = (k: 'openingHymn' | 'sacramentHymn' | 'closingHymn', label: string) => {
    const h: HymnAnswer = answers[k]
    const missing = !h.number.trim() && !h.title.trim()
    return (
      <div key={k}>
        <div className="row script-hymn">
          <label>{label} #<input inputMode="numeric" value={h.number} onChange={(ev) => set(k, { ...h, number: ev.target.value })} /></label>
          <label>Title<input value={h.title} onChange={(ev) => set(k, { ...h, title: ev.target.value })} /></label>
        </div>
        {missing && <p className="muted small">Not on the program yet. Type it here to add it to the script.</p>}
      </div>
    )
  }

  // The bishop presides: his name from Roles, once one has been entered there.
  const bishop = leaders[0] ?? ''
  const presiding = bishop && bishop !== ROLES[0].label ? `Bishop ${bishop.replace(/^Bishop\s+/i, '')}` : ''
  const bishopConducting = !!leaders[0] && conducting === leaders[0]
  const dyslexic = answers.dyslexic ?? bishopConducting // on for the bishop unless someone turns it off
  const standard = buildScript({ date, bishopConducting, answers: { ...answers, ...merged, presiding }, conducting: ROLES.some((r) => r.label === conducting) ? '' : conducting, entries: sorted, people: named })
  const blocks = manual ?? standard

  return createPortal(
    <div className="modal script-modal" onClick={onClose}>
      <div className="sheet script-sheet" role="dialog" aria-modal="true" aria-label="Conducting script" onClick={(ev) => ev.stopPropagation()}>
        <div className="script-tools no-print">
          <h2>Conducting Script · {format(parseISO(date), 'MMM d')}</h2>
          <div className="row actions">
            <button className="primary" onClick={() => window.print()}>Print / Save PDF</button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="script-tabs no-print">
          <button className={pane === 'form' ? 'primary' : ''} onClick={() => setPane('form')}>Meeting Setup</button>
          <button className={pane === 'script' ? 'primary' : ''} onClick={() => setPane('script')}>Script</button>
        </div>

        <div className={`script-body show-${pane}`}>
        <div className="script-wizard no-print">
          <h3 className="wiz-section">Presiding and Visitors</h3>
          <label>Conducting
            <select value={conducting} onChange={(ev) => {
              onConducting(ev.target.value)
              // The bishop's script is printed in the dyslexia-friendly font: choosing him turns it on, and choosing anyone else goes back to off.
              setAnswers({ ...answers, dyslexic: ev.target.value === leaders[0] ? true : undefined })
            }}>
              {!leaders.includes(conducting) && <option value={conducting}>{conducting || 'No one'}</option>}
              {leaders.map((l, i) => <option key={l} value={l}>{l}{l !== ROLES[i].label ? ` (${ROLES[i].label})` : ''}</option>)}
            </select>
          </label>
          <h4 className="wiz-sub">Visiting leaders to recognize (if known)</h4>
          {[...answers.visitors, emptyVisitor()].map((v, i) => {
            const isNew = i === answers.visitors.length
            // Only rows with someone chosen are kept; a fresh empty row always follows for the next leader.
            const save = (next: Visitor) => {
              const list = isNew ? [...answers.visitors, next] : answers.visitors.map((x, j) => (j === i ? next : x))
              // Only one person can preside: checking one clears the rest.
              const only = list.map((x) => (next.presiding && x !== next ? { ...x, presiding: false } : x))
              set('visitors', only.filter((x) => x.who !== ''))
            }
            return (
              <div className="visitor-row" key={i}>
                <label>Name
                  <select value={v.who} onChange={(ev) => {
                    const leader = STAKE_LEADERS.find((l) => l.key === ev.target.value)
                    save({ ...v, who: ev.target.value, position: leader ? leader.position : v.position })
                  }}>
                    <option value="">{isNew && i > 0 ? 'Add another' : 'Choose'}</option>
                    {STAKE_LEADERS.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
                    <option value="other">Other</option>
                  </select>
                  {v.who === 'other' && <input aria-label="Name" value={v.name} placeholder="Type a name" onChange={(ev) => save({ ...v, name: ev.target.value })} />}
                </label>
                <label>Position
                  <select value={v.position} disabled={v.who === ''} onChange={(ev) => save({ ...v, position: ev.target.value })}>
                    <option value=""> </option>
                    {Object.entries(POSITIONS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    <option value="other">Other</option>
                  </select>
                  {v.position === 'other' && <input aria-label="Position" value={v.positionText} placeholder="Type a position" onChange={(ev) => save({ ...v, positionText: ev.target.value })} />}
                </label>
                {v.who === 'other' && (
                  <label className="wiz-check presiding-check">
                    <input type="checkbox" checked={!!v.presiding} onChange={(ev) => save({ ...v, presiding: ev.target.checked })} /> Presiding?
                  </label>
                )}
                {!isNew && <button type="button" className="danger" aria-label="Remove this visiting leader" onClick={() => set('visitors', answers.visitors.filter((_, j) => j !== i))}>✕</button>}
              </div>
            )
          })}

          <h3 className="wiz-section">Announcements</h3>
          {pulled('announcements', 'Announcements', 'Event, date, time, location, what to bring')}

          <h3 className="wiz-section">Music</h3>
          <div className="row">
            {text('pianist', 'Pianist / organist')}
            {text('chorister', 'Chorister')}
          </div>
          {hymn('openingHymn', 'Opening hymn')}
          {hymn('sacramentHymn', 'Sacrament hymn')}
          {hymn('closingHymn', 'Closing hymn')}
          <h4 className="wiz-sub">Musical numbers</h4>
          {sorted.filter((e) => e.role === 'musical' || e.role === 'choir').map((e) => (
            <div className="music-row" key={e.id}>
              <span><strong>{describeEntry(e).headline}</strong> <small className="muted">{describeEntry(e).label}{describeEntry(e).sub ? ` · ${describeEntry(e).sub}` : ''}</small></span>
              <button type="button" className="danger" aria-label={`Remove ${describeEntry(e).headline}`} onClick={() => removeEntry(e)}>✕</button>
            </div>
          ))}
          {addingMusic ? (
            <div className="music-form">
              <label>Kind
                <select value={musicType} onChange={(ev) => setMusicType(ev.target.value as 'musical' | 'choir')}>
                  <option value="musical">Special Musical Number</option>
                  <option value="choir">Ward Choir Number</option>
                </select>
              </label>
              <label>{musicType === 'choir' ? 'Director (optional)' : 'Performer(s)'}
                <input value={music.performers} onChange={(ev) => setMusic({ ...music, performers: ev.target.value })} />
              </label>
              <label>Song Title<input value={music.title} onChange={(ev) => setMusic({ ...music, title: ev.target.value })} /></label>
              <div className="row actions">
                <button type="button" className="primary" disabled={!canAddMusic} onClick={addMusic}>Add</button>
                <button type="button" onClick={() => { setAddingMusic(false); setMusic({ performers: '', title: '' }) }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingMusic(true)}>+ Add Musical Number</button>
          )}

          <h3 className="wiz-section">Callings</h3>
          {pulled('releases', 'Releases (one per line)', 'Name as Calling')}
          {pulled('sustainings', 'Sustainings (one per line)', 'Name as Calling')}

          <h3 className="wiz-section">Other Business</h3>
          <label className="wiz-check">
            <input type="checkbox" checked={answers.stakeBusiness} onChange={(ev) => setAnswers({ ...answers, stakeBusiness: ev.target.checked, stakeWho: ev.target.checked ? answers.stakeWho : '' })} /> Stake business
          </label>
          {answers.stakeBusiness && (
            <div className="stake-name">
              <label>Who will conduct the stake business?
                <input value={answers.stakeWho} placeholder="Leave blank to write it in" onChange={(ev) => set('stakeWho', ev.target.value)} />
              </label>
            </div>
          )}
          <label className="wiz-check"><input type="checkbox" checked={answers.babyBlessings} onChange={(ev) => set('babyBlessings', ev.target.checked)} /> Baby blessing</label>
          {answers.babyBlessings && (
            <div className="baby-names">
              {answers.babies.map((n, i) => (
                <div className="row" key={i}>
                  <label>Child’s name{answers.babies.length > 1 ? ` ${i + 1}` : ''}
                    <input value={n} placeholder="Leave blank to write it in" onChange={(ev) => set('babies', answers.babies.map((x, j) => (j === i ? ev.target.value : x)))} />
                  </label>
                  {answers.babies.length > 1 && <button type="button" className="danger" aria-label={`Remove child ${i + 1}`} onClick={() => set('babies', answers.babies.filter((_, j) => j !== i))}>✕</button>}
                </div>
              ))}
              <button type="button" onClick={() => set('babies', [...answers.babies, ''])}>+ Add another child</button>
            </div>
          )}

          <h3 className="wiz-section">Prayers and Speakers</h3>
          {sorted.length === 0 && <p className="muted small">Nothing on the program yet. Add prayers and speakers on the Sacrament tab.</p>}
          {(() => {
            const isSpeaker = (e: SacramentEntry) => ['youth-speaker', 'adult-speaker', 'speaker'].includes(e.role)
            const personRow = (e: SacramentEntry) => {
              const n = named[e.id]
              const chosen = answers.titles[e.id] ?? defaultTitle(n.name, n.group, e.details?.affiliation) ?? ''
              if (changing === e.id) {
                return (
                  <div className="change-row">
                    {e.role === 'youth-speaker' ? (
                      <select autoFocus value={changeTo} onChange={(ev) => setChangeTo(ev.target.value)} aria-label="Choose a youth">
                        <option value="">Choose a youth</option>
                        {youthByLastSpoke(youth, [], '').map(({ youth: y }) => <option key={y.id} value={y.id}>{y.name}</option>)}
                      </select>
                    ) : (
                      <input autoFocus list={e.role === 'speaker' ? undefined : 'wiz-people'} value={changeTo} placeholder="Type or choose a name" onChange={(ev) => setChangeTo(ev.target.value)} />
                    )}
                    <button type="button" className="primary" onClick={() => changePerson(e)}>Save</button>
                    <button type="button" onClick={() => { setChanging(null); setPartError('') }}>Cancel</button>
                  </div>
                )
              }
              return (
                <>
                  <label className="title-pick">
                    <select value={chosen} onChange={(ev) => set('titles', { ...answers.titles, [e.id]: ev.target.value })} aria-label={`Title for ${n.name}`}>
                      <option value=""> </option>
                      {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                      {isSpeaker(e) && <option value={YOUTH_SPEAKER}>{YOUTH_SPEAKER}</option>}
                      {isSpeaker(e) && <option value={HIGH_COUNCILOR}>{HIGH_COUNCILOR}</option>}
                    </select>
                    <span>{n.name || 'Unknown'}<small className="muted">{ROLE_LABEL[e.role]}</small></span>
                  </label>
                  <span className="part-actions">
                    <button type="button" aria-label={`Change who is ${ROLE_LABEL[e.role]}`} title="Change who" onClick={() => { setChanging(e.id); setChangeTo(e.role === 'youth-speaker' ? e.youthId ?? '' : n.name); setPartError('') }}><PencilIcon /></button>
                    <button type="button" className="danger" aria-label={`Remove ${n.name}`} title="Remove" onClick={() => removePart(e)}>✕</button>
                  </span>
                </>
              )
            }
            const fixed = (e?: SacramentEntry) => e && <div className="speaker-row fixed-row">{named[e.id] && personRow(e)}</div>
            const kinds: { role: SacramentRole; label: string }[] = [
              ...(opening ? [] : [{ role: 'invocation' as const, label: 'Opening Prayer' }]),
              ...(closing ? [] : [{ role: 'benediction' as const, label: 'Closing Prayer' }]),
              { role: 'youth-speaker', label: 'Youth Speaker' },
              { role: 'adult-speaker', label: 'Adult Speaker' },
              { role: 'speaker', label: 'Visiting Speaker' },
            ]
            return (
              <>
                {fixed(opening)}
                {movable.length > 1 && <p className="muted small drag-hint">Drag <span aria-hidden="true">⋮⋮</span> to change the order.</p>}
                <ReorderList
                  items={movable}
                  onReorder={reorder}
                  render={(e, handle) => (
                    <div className="speaker-row">
                      {handle}
                      {named[e.id] ? personRow(e) : (
                        <div className="title-pick">
                          <span className="kind-tag">{ROLE_LABEL[e.role]}</span>
                          <span>{describeEntry(e).headline}{describeEntry(e).sub && <small className="muted">{describeEntry(e).sub}</small>}</span>
                        </div>
                      )}
                    </div>
                  )}
                />
                {fixed(closing)}
                {partError && !addingPart && <p role="alert" className="form-error">{partError}</p>}
                <datalist id="wiz-affiliations"><option value="High Councilor" /></datalist>
                <datalist id="wiz-people">
                  {members.map((m) => <option key={m.id} value={m.name} />)}
                  {youth.map((y) => <option key={y.id} value={y.name} />)}
                </datalist>
                {addingPart ? (
                  <div className="music-form">
                    <label>Add
                      <select value={partKind} onChange={(ev) => { setPartKind(ev.target.value as SacramentRole); setPartError('') }}>
                        {kinds.map((k) => <option key={k.role} value={k.role}>{k.label}</option>)}
                      </select>
                    </label>
                    {partKind === 'youth-speaker' ? (
                      <label>Youth
                        <select value={part.youth} onChange={(ev) => setPart({ ...part, youth: ev.target.value })}>
                          <option value="">{youth.length ? 'Choose a youth' : 'Add youth in Setup first'}</option>
                          {youthByLastSpoke(youth, [], '').map(({ youth: y }) => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                      </label>
                    ) : (
                      <label>Name
                        <input list={partKind === 'speaker' ? undefined : 'wiz-people'} value={part.name} placeholder="Type or choose a name" onChange={(ev) => setPart({ ...part, name: ev.target.value })} />
                      </label>
                    )}
                    {partKind === 'speaker' && (
                      <label>Who they are (e.g. High Councilor)<input list="wiz-affiliations" value={part.affiliation} onChange={(ev) => setPart({ ...part, affiliation: ev.target.value })} /></label>
                    )}
                    {partError && <p role="alert" className="form-error">{partError}</p>}
                    <div className="row actions">
                      <button type="button" className="primary" onClick={addPartEntry}>Add</button>
                      <button type="button" onClick={() => { setAddingPart(false); setPartError('') }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setAddingPart(true); setPartKind(kinds[0].role); setPartError('') }}>+ Add Speaker or Prayer</button>
                )}
                <p className="muted small">Changes here also update the Sacrament tab, so the speaker list and “not asked lately” stay in step.</p>
              </>
            )
          })()}
        </div>

        <div className="script-column">
        <div className="script-edit-bar no-print">
          {manual && !editing && <span className="muted small">Edited by hand for this Sunday.</span>}
          <button type="button" role="switch" aria-checked={dyslexic} className={`switch ${dyslexic ? 'on' : ''}`} onClick={() => set('dyslexic', !dyslexic)}>
            <span className="switch-label">Dyslexia font</span>
            <span className="track" aria-hidden="true"><span className="thumb" /></span>
          </button>
          <button type="button" className={editing ? 'primary' : ''} onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : <><PencilIcon /> Edit</>}
          </button>
        </div>
        {manual && (
          <p className="script-edited-note no-print">
            This script has been edited by hand. It applies to this Sunday only, and changes in Meeting Setup no longer update it.{' '}
            <button type="button" className="link-btn" onClick={() => { setManual(null); setEditing(false) }}>Reset to the standard script</button>
          </p>
        )}
        <article className={`script-page${editing ? ' is-editing' : ''}${dyslexic ? ' dys-font' : ''}`}>
          {blocks.map((b, i) => {
            if (editing) {
              const value = b.kind === 'list' ? b.items.join('\n') : b.text
              const change = (v: string) =>
                setManual(blocks.map((x, j) => (j !== i ? x : x.kind === 'list' ? { ...x, items: v.split('\n') } : { ...x, text: v })))
              return <AutoTextarea multiline key={i} className={`script-edit script-edit-${b.kind}`} value={value} aria-label={`Edit ${b.kind}`} onChange={(ev) => change(ev.target.value)} />
            }
            switch (b.kind) {
              case 'title': return <h1 key={i}>{b.text}</h1>
              case 'sub': return <h4 key={i}><Marked text={b.text} /></h4>
              case 'heading': return <h3 key={i} className="script-heading">{b.text}</h3>
              case 'cue': return <p key={i} className="script-cue">[{b.text}]</p>
              case 'list': return <ul key={i}>{b.items.filter(Boolean).map((x, j) => <li key={j}><Marked text={x} /></li>)}</ul>
              default: return <p key={i} className="script-say"><Marked text={b.text} /></p>
            }
          })}
        </article>
        </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
