import { useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useBlocker } from '../../components/useBlocker'
import { useDismiss } from '../../components/useDismiss'
import { findByName } from '../../data/nicknames'
import { ENTRY_TYPES, PRAYER_ROLES, ROLE_LABEL, describeEntry, missingFields, moveEntry, nextOrder, sortEntries, youthByLastSpoke, type EntryType } from '../../data/sacrament'
import type { SpecialMeeting } from '../../data/special'
import { memberStore, sacramentStore } from '../../data/store'
import type { Member, SacramentEntry, Youth } from '../../data/types'
import ScriptSheet from './ScriptSheet'

interface Props {
  date: string
  entries: SacramentEntry[]
  members: Member[]
  youth: Youth[]
  allEntries: SacramentEntry[] // every meeting, to see who spoke most recently
  special: SpecialMeeting // events on this Sunday (General Conference, Stake Conference...)
  conducting: string // who conducts, from the Conducting Schedule on the Schedule tab
  leaders: string[] // the bishop and his counselors, to choose from
  presiding: string // the bishop's name, for the script
  onConducting: (name: string) => void // writes the choice back to the Conducting Schedule
  onChange: () => void
}

// One Sunday's program. The + in the red heading offers the kinds of items that can be added; picking one
// shows just the fields that apply to it.
export default function MeetingCard({ date, entries, members, youth, allEntries, special, conducting, leaders, presiding, onConducting, onChange }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [type, setType] = useState<EntryType | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [scriptOpen, setScriptOpen] = useState(false)
  const { block, dialog } = useBlocker()
  const menuRef = useRef<HTMLDivElement>(null)

  // Past visiting speakers, most recent first, to pick from when adding one again.
  const visitorsSeen = useMemo(() => {
    const seen = new Map<string, { name: string; affiliation?: string; date: string }>()
    for (const e of allEntries) {
      const name = e.role === 'speaker' ? e.details?.name?.trim() : undefined
      if (!name) continue
      const cur = seen.get(name.toLowerCase())
      if (!cur || e.date > cur.date) seen.set(name.toLowerCase(), { name, affiliation: e.details?.affiliation || cur?.affiliation, date: e.date })
    }
    return [...seen.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [allEntries])

  const sorted = sortEntries(entries)
  const nameOf = (e: SacramentEntry) => e.youthId ? youth.find((y) => y.id === e.youthId)?.name : members.find((m) => m.id === e.memberId)?.name

  useDismiss(menuRef, menuOpen, () => setMenuOpen(false)) // close on a tap elsewhere or Escape

  const choose = (t: EntryType) => {
    setType(t)
    setValues({})
    setError('')
    setMenuOpen(false)
  }
  const cancel = () => { setType(null); setValues({}); setError('') }

  const add = async () => {
    if (!type) return
    const problem = missingFields(type, values)
    if (problem) { setError(problem); return }

    // One person can't be given two parts in the same meeting (a prayer and a talk, say).
    const typed = values.person?.trim().toLowerCase()
    const who = type.fields.some((f) => f.key === 'youth')
      ? { youthId: values.youth }
      : typed
        ? (() => {
            const m = findByName(members, typed)
            const y = !m && PRAYER_ROLES.includes(type.role) ? youth.find((x) => x.name.toLowerCase() === typed) : undefined
            return m ? { memberId: m.id } : y ? { youthId: y.id } : null
          })()
        : null
    const already = who && entries.find((e) => (who.memberId ? e.memberId === who.memberId : e.youthId === who.youthId))
    if (already) {
      const name = who.memberId ? members.find((m) => m.id === who.memberId)?.name : youth.find((y) => y.id === who.youthId)?.name
      block([`${name} is already on the ${format(parseISO(date), 'MMM d')} program as ${ROLE_LABEL[already.role]}.`])
      return
    }

    const entry: SacramentEntry = { id: crypto.randomUUID(), date, role: type.role, order: nextOrder(entries) }
    const details: Record<string, string> = {}
    for (const f of type.fields) {
      const v = values[f.key]?.trim()
      if (!v) continue
      if (f.key === 'youth') entry.youthId = v
      else if (f.key === 'person') {
        // A youth giving a prayer is recorded against the Youth Roster. Anyone else new is added to Ward Members.
        const lower = v.toLowerCase()
        let member = findByName(members, v)
        const young = PRAYER_ROLES.includes(type.role) ? youth.find((y) => y.name.toLowerCase() === lower) : undefined
        if (!member && young) entry.youthId = young.id
        else if (!member) {
          member = { id: crypto.randomUUID(), name: v }
          await memberStore.save(member)
        }
        if (member) entry.memberId = member.id
      } else details[f.key] = v
    }
    if (Object.keys(details).length) entry.details = details
    await sacramentStore.save(entry)
    cancel()
    onChange()
  }

  const move = async (index: number, dir: -1 | 1) => {
    const moved = moveEntry(entries, index, dir)
    if (!moved) return
    await Promise.all(moved.map((e) => sacramentStore.save(e)))
    onChange()
  }
  const remove = async (e: SacramentEntry) => { await sacramentStore.remove(e.id); onChange() }

  return (
    <div className="card meeting-card">
      <div className="date-head meeting-head">
        <h2>
          {format(parseISO(date), 'EEEE, MMM d, yyyy')}
          {special.labels.length > 0 && <span className="event-label"> · {special.labels.join(' · ')}</span>}
        </h2>
        {special.canSchedule && <div className="head-actions">
          <button className="ghost-btn live" onClick={() => setScriptOpen(true)} aria-label={`Export the ${format(parseISO(date), 'MMM d')} conducting script`}>
            Export Script<small>(Draft)</small>
          </button>
        <div className="add-menu" ref={menuRef}>
          <button
            className="icon-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={`Add to the ${format(parseISO(date), 'MMM d')} meeting`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Add to this meeting"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          {menuOpen && (
            <ul className="menu" role="menu">
              {ENTRY_TYPES.map((t) => (
                <li key={t.role} role="none"><button role="menuitem" onClick={() => choose(t)}>{t.label}</button></li>
              ))}
            </ul>
          )}
        </div>
        </div>}
      </div>

      <div className="meeting-body">
        {special.canSchedule && (
          <label className="conducting-pick">Conducting:
            <select value={conducting} onChange={(ev) => onConducting(ev.target.value)}>
              {!leaders.includes(conducting) && <option value={conducting}>{conducting || 'No one'}</option>}
              {leaders.map((l) => <option key={l} value={l}>{l}</option>)}
              {leaders.includes(conducting) && <option value="">No one</option>}
            </select>
          </label>
        )}
        {sorted.length === 0 && !type && (
          <p className="muted">
            {special.canSchedule ? 'Nothing on the program yet. Tap + to add something.' : `${special.labels.join(' · ')}: nothing to schedule.`}
          </p>
        )}
        <ul className="plain">
          {sorted.map((e, i) => {
            const text = describeEntry(e, nameOf(e))
            return (
              <li key={e.id} className="program-item">
                <span className="program-text">
                  <strong>{text.headline}</strong>
                  <span className="muted program-sub">{text.label}{text.sub ? ` · ${text.sub}` : ''}</span>
                </span>
                <span className="row-actions">
                  {sorted.length > 1 && (
                    <>
                      <button disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${text.headline} up`}>↑</button>
                      <button disabled={i === sorted.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${text.headline} down`}>↓</button>
                    </>
                  )}
                  <button className="danger" aria-label={`Remove ${text.headline}`} onClick={() => remove(e)}>✕</button>
                </span>
              </li>
            )
          })}
        </ul>

        {type && (
          <form className="add-entry" onSubmit={(ev) => { ev.preventDefault(); add() }}>
            <h3>{type.label}</h3>
            {type.fields.map((f, i) => (
              f.key === 'youth' ? (
                <label key={f.key}>{f.label}
                  <select autoFocus value={values.youth ?? ''} onChange={(ev) => { setValues({ ...values, youth: ev.target.value }); setError('') }}>
                    <option value="">{youth.length ? 'Choose a youth' : 'Add youth in Setup first'}</option>
                    {youthByLastSpoke(youth, allEntries, format(new Date(), 'yyyy-MM-dd')).map(({ youth: y, last }) => (
                      <option key={y.id} value={y.id}>{y.name}{last ? ` (spoke ${format(parseISO(last), 'MMM d')})` : ' (never)'}</option>
                    ))}
                  </select>
                </label>
              ) : (
              <label key={f.key}>{f.label}
                <input
                  autoFocus={i === 0}
                  list={f.key === 'person' ? `roster-${date}` : f.key === 'name' ? `visitors-${date}` : undefined}
                  value={values[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(ev) => {
                    const v = ev.target.value
                    const next = { ...values, [f.key]: v }
                    // A visitor who has spoken before: fill in who they are.
                    if (f.key === 'name' && !values.affiliation) {
                      const known = visitorsSeen.find((x) => x.name.toLowerCase() === v.trim().toLowerCase())
                      if (known?.affiliation) next.affiliation = known.affiliation
                    }
                    setValues(next)
                    setError('')
                  }}
                />
              </label>
              )
            ))}
            <datalist id={`visitors-${date}`}>
              {visitorsSeen.map((v) => <option key={v.name} value={v.name} />)}
            </datalist>
            <datalist id={`roster-${date}`}>
              {members.map((m) => <option key={m.id} value={m.name} />)}
              {PRAYER_ROLES.includes(type.role) && youth.map((y) => <option key={y.id} value={y.name} />)}
            </datalist>
            {error && <p role="alert" className="form-error">{error}</p>}
            <div className="row actions">
              <button type="submit" className="primary">Add</button>
              <button type="button" onClick={cancel}>Cancel</button>
            </div>
          </form>
        )}

      </div>
      {dialog}
      {scriptOpen && (
        <ScriptSheet date={date} entries={entries} members={members} youth={youth} conducting={conducting} presiding={presiding} onClose={() => setScriptOpen(false)} />
      )}
    </div>
  )
}
