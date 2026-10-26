import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { ROLES } from '../../data/roles'
import { ROLE_LABEL, sortEntries } from '../../data/sacrament'
import { TITLES, buildScript, defaultAnswers, defaultTitle, type HymnAnswer, type ScriptAnswers } from '../../data/script'
import { listStore, settingStore } from '../../data/store'
import type { Member, SacramentEntry, Youth } from '../../data/types'

interface Props {
  date: string
  entries: SacramentEntry[]
  members: Member[]
  youth: Youth[]
  conducting: string // from the Conducting Schedule
  presiding: string // the bishop's name from Roles
  onClose: () => void
}

const answersKey = (date: string) => `script:${date}`

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
export default function ScriptSheet({ date, entries, members, youth, conducting, presiding, onClose }: Props) {
  const [answers, setAnswers] = useState<ScriptAnswers | null>(null)
  type Pulled = { announcements: string; releases: string; sustainings: string }
  // This Sunday's Sacrament Announcements, Releases and Sustainings on the Bishopric Agenda
  const [agenda, setAgenda] = useState<Pulled>({ announcements: '', releases: '', sustainings: '' })
  const [stakeAsk, setStakeAsk] = useState(false)
  const loaded = useRef(false)

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
      if (!base.presiding) base.presiding = presiding && presiding !== 'Bishop' ? `Bishop ${presiding.replace(/^Bishop\s+/i, '')}` : ''
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
  const stakeLabel = answers.stakeWho.trim() || 'to be written in'

  const blocks = buildScript({ answers: { ...answers, ...merged }, conducting: ROLES.some((r) => r.label === conducting) ? '' : conducting, entries: sorted, people: named })

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

        <details className="script-wizard no-print" open>
          <summary>Questions for this Sunday</summary>
          <h3 className="wiz-section">Presiding and Visitors</h3>
          {text('presiding', 'Presiding', 'e.g. Bishop Smith')}
          {text('visiting', 'Visiting leaders to recognize (if known)', 'Leave blank to write it in on the printed script')}

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

          <h3 className="wiz-section">Callings</h3>
          {pulled('releases', 'Releases (one per line)', 'Name as Calling')}
          {pulled('sustainings', 'Sustainings (one per line)', 'Name as Calling')}

          <h3 className="wiz-section">Other Business</h3>
          <label className="check">
            <input type="checkbox" checked={answers.stakeBusiness} onChange={(ev) => {
              setAnswers({ ...answers, stakeBusiness: ev.target.checked, stakeWho: ev.target.checked ? answers.stakeWho : '' })
              setStakeAsk(ev.target.checked)
            }} /> Stake business
          </label>
          {answers.stakeBusiness && (
            <p className="muted small stake-who">Stake business: {stakeLabel} <button type="button" className="link-btn" onClick={() => setStakeAsk(true)}>Edit</button></p>
          )}
          <label className="check"><input type="checkbox" checked={answers.babyBlessings} onChange={(ev) => set('babyBlessings', ev.target.checked)} /> Baby blessing</label>
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

          {Object.values(named).length > 0 && (
            <>
              <h3 className="wiz-section">Prayers and Speakers</h3>
              {Object.values(named).map(({ entry, name, group }) => {
                const chosen = answers.titles[entry.id] ?? defaultTitle(name, group)
                return (
                  <fieldset key={entry.id} className="title-pick">
                    <legend>{name || 'Unknown'} <small className="muted">{ROLE_LABEL[entry.role]}</small></legend>
                    {[...TITLES, ''].map((t) => (
                      <label key={t || 'as-is'} className="check">
                        <input type="radio" name={`title-${entry.id}`} checked={chosen === t} onChange={() => set('titles', { ...answers.titles, [entry.id]: t })} /> {t || 'As entered'}
                      </label>
                    ))}
                  </fieldset>
                )
              })}
            </>
          )}
        </details>

        <article className="script-page">
          {blocks.map((b, i) => {
            switch (b.kind) {
              case 'title': return <h1 key={i}>{b.text}</h1>
              case 'sub': return <h4 key={i}><Marked text={b.text} /></h4>
              case 'heading': return <h3 key={i} className="script-heading">{b.text}</h3>
              case 'cue': return <p key={i} className="script-cue">[{b.text}]</p>
              case 'list': return <ul key={i}>{b.items.map((x, j) => <li key={j}><Marked text={x} /></li>)}</ul>
              default: return <p key={i} className="script-say"><Marked text={b.text} /></p>
            }
          })}
        </article>
      </div>
      {stakeAsk && (
        <div className="modal no-print" onClick={(ev) => { ev.stopPropagation(); setStakeAsk(false) }}>
          <form className="sheet popup" role="dialog" aria-modal="true" aria-label="Stake business" onClick={(ev) => ev.stopPropagation()}
            onSubmit={(ev) => { ev.preventDefault(); setStakeAsk(false) }}>
            <h2>Stake business</h2>
            <label>Who will conduct the stake business?
              <input autoFocus value={answers.stakeWho} placeholder="Leave blank to write it in" onChange={(ev) => set('stakeWho', ev.target.value)} />
            </label>
            <div className="row actions">
              <button type="submit" className="primary">Done</button>
            </div>
          </form>
        </div>
      )}
    </div>,
    document.body,
  )
}
