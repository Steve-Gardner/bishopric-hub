import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { ROLES } from '../../data/roles'
import { sortEntries } from '../../data/sacrament'
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
  const [agendaAnnouncements, setAgendaAnnouncements] = useState('') // this Sunday's Sacrament Announcements on the Bishopric Agenda
  const loaded = useRef(false)

  useEffect(() => {
    let alive = true
    Promise.all([settingStore.list(), listStore.list()]).then(([all, lists]) => {
      if (!alive) return
      setAgendaAnnouncements(
        lists.filter((i) => i.list === `agenda:announcements@${date}`).sort((a, b) => a.order - b.order)
          .map((i) => [i.text, i.notes?.replace(/\s*\n\s*/g, ' ').trim()].filter(Boolean).join(': ')).join('\n'),
      )
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
  const hymn = (k: 'openingHymn' | 'sacramentHymn' | 'closingHymn', label: string) => {
    const h: HymnAnswer = answers[k]
    return (
      <div className="row script-hymn" key={k}>
        <label>{label} #<input inputMode="numeric" value={h.number} onChange={(ev) => set(k, { ...h, number: ev.target.value })} /></label>
        <label>Title<input value={h.title} onChange={(ev) => set(k, { ...h, title: ev.target.value })} /></label>
      </div>
    )
  }
  const announcements = answers.announcements ?? agendaAnnouncements
  const text = (k: keyof ScriptAnswers, label: string, hint?: string) => (
    <label>{label}<input value={answers[k] as string} placeholder={hint} onChange={(ev) => set(k, ev.target.value as never)} /></label>
  )
  const area = (k: keyof ScriptAnswers, label: string, hint?: string) => (
    <label>{label}<textarea rows={3} value={answers[k] as string} placeholder={hint} onChange={(ev) => set(k, ev.target.value as never)} /></label>
  )

  const blocks = buildScript({ answers: { ...answers, announcements }, conducting: ROLES.some((r) => r.label === conducting) ? '' : conducting, entries: sorted, people: named })

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
          <p className="muted">Conducting and the speakers, prayers and hymns come from the program. Fill in anything else; gaps show highlighted in the script.</p>
          {text('presiding', 'Presiding', 'e.g. Bishop Smith')}
          {text('visiting', 'Visiting leaders to recognize (if known)', 'Leave blank to write it in on the printed script')}
          <div className="row">
            {text('pianist', 'Pianist / organist')}
            {text('chorister', 'Chorister')}
          </div>
          <label>Announcements (from the Bishopric Agenda; edit as needed)
            <textarea rows={3} value={announcements} placeholder="Event, date, time, location, what to bring" onChange={(ev) => set('announcements', ev.target.value)} />
          </label>
          {answers.announcements !== undefined && answers.announcements !== agendaAnnouncements && (
            <button type="button" className="link-btn" onClick={() => setAnswers({ ...answers, announcements: undefined })}>Use the agenda’s announcements again</button>
          )}
          {hymn('openingHymn', 'Opening hymn')}
          {hymn('sacramentHymn', 'Sacrament hymn')}
          {hymn('closingHymn', 'Closing hymn')}
          {area('releases', 'Releases (one per line)', 'Name as Calling')}
          {area('sustainings', 'Sustainings (one per line)', 'Name as Calling')}
          <label className="check"><input type="checkbox" checked={answers.stakeBusiness} onChange={(ev) => set('stakeBusiness', ev.target.checked)} /> Stake business</label>
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
              <h3>Titles</h3>
              {Object.values(named).map(({ entry, name, group }) => {
                const chosen = answers.titles[entry.id] ?? defaultTitle(name, group)
                return (
                  <fieldset key={entry.id} className="title-pick">
                    <legend>{name || 'Unknown'}</legend>
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
    </div>,
    document.body,
  )
}
