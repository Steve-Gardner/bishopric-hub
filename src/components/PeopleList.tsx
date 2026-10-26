import { useEffect, useState } from 'react'
import { individualStore } from '../data/store'
import AutoTextarea from './AutoTextarea'
import EyeIcon from './EyeIcon'
import type { Individual } from '../data/types'

interface Props {
  placeholder: string
  onChange?: () => void // called after someone is added, renamed, or removed
}

// People and families that stay on the agenda from week to week, each with a button for private notes.
export default function PeopleList({ placeholder, onChange }: Props) {
  const [people, setPeople] = useState<Individual[]>([])
  const [name, setName] = useState('')
  const [noting, setNoting] = useState<Individual | null>(null)
  const [draft, setDraft] = useState('')

  const reload = async () => {
    const all = (await individualStore.list()).sort((a, b) => (a.kind === b.kind ? a.order - b.order : a.kind === 'individual' ? -1 : 1))
    // This used to be two lists (individuals and spiritual needs). Merge them into one, keeping order and notes.
    if (all.some((p) => p.kind !== 'individual')) {
      await Promise.all(all.map((p, i) => individualStore.save({ ...p, kind: 'individual', order: i })))
      return reload()
    }
    setPeople(all.sort((a, b) => a.order - b.order))
  }
  useEffect(() => { reload() }, [])

  const add = async () => {
    const n = name.trim()
    if (!n) return
    const order = people.length ? Math.max(...people.map((p) => p.order)) + 1 : 0
    await individualStore.save({ id: crypto.randomUUID(), kind: 'individual', name: n, order })
    setName('')
    reload()
    onChange?.()
  }
  const patch = async (p: Individual, change: Partial<Individual>) => { await individualStore.save({ ...p, ...change }); reload(); onChange?.() }
  // The only way someone leaves this list is the remove button, and it always asks first.
  const remove = async (p: Individual) => {
    if (!confirm(`Remove ${p.name} from the list${p.notes ? ' and delete their notes' : ''}?`)) return
    await individualStore.remove(p.id)
    reload()
    onChange?.()
  }
  const openNotes = (p: Individual) => { setNoting(p); setDraft(p.notes ?? '') }
  const saveNotes = async () => {
    if (!noting) return
    await patch(noting, { notes: draft.trim() || undefined })
    setNoting(null)
  }

  return (
    <>
      <ul className="plain">
        {people.map((p) => (
          <li key={p.id} className="person">
            <AutoTextarea
              key={p.id + p.name}
              defaultValue={p.name}
              aria-label="Name"
              onBlur={(ev) => {
                const v = ev.target.value.trim()
                if (!v) ev.target.value = p.name // clearing the text never removes someone
                else if (v !== p.name) patch(p, { name: v })
              }}
            />
            <button
              className={`icon-btn council-btn ${p.hideFromCouncil ? 'hidden-from-council' : ''}`}
              onClick={() => patch(p, { hideFromCouncil: p.hideFromCouncil ? undefined : true })}
              aria-pressed={!!p.hideFromCouncil}
              aria-label={p.hideFromCouncil ? `${p.name} is hidden from the Ward Council. Show` : `Hide ${p.name} from the Ward Council`}
              title={p.hideFromCouncil ? 'Hidden from the Ward Council. Tap to show.' : 'Shown on the Ward Council. Tap to hide.'}
            >
              <EyeIcon off={!!p.hideFromCouncil} />
            </button>
            <button
              className={`icon-btn notes-btn ${p.notes || p.councilNotes ? 'has' : ''}`}
              onClick={() => openNotes(p)}
              aria-label={p.notes || p.councilNotes ? `Notes for ${p.name} (has notes)` : `Notes for ${p.name}`}
              title={p.notes || p.councilNotes ? 'View or edit notes' : 'Add notes'}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <path d="M14 3v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h5" />
              </svg>
            </button>
            <button className="danger" onClick={() => remove(p)} aria-label={`Remove ${p.name}`}>✕</button>
          </li>
        ))}
        {people.length === 0 && <li className="muted">No one yet.</li>}
      </ul>
      <form className="row add-row" onSubmit={(ev) => { ev.preventDefault(); add() }}>
        <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder={placeholder} />
        <button type="submit" className="primary" disabled={!name.trim()}>Add</button>
      </form>

      {noting && (
        <div className="modal modal-top" onClick={() => setNoting(null)}>
          <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); saveNotes() }}>
            <h2>Notes: {noting.name}</h2>
            {noting.councilNotes && (
              <div className="council-notes">
                <strong>From the Ward Council</strong>
                <p>{noting.councilNotes}</p>
              </div>
            )}
            <label>
              <textarea autoFocus rows={8} value={draft} onChange={(ev) => setDraft(ev.target.value)} placeholder="Add notes…" />
            </label>
            <div className="row actions">
              <button type="submit" className="primary">Save</button>
              <button type="button" onClick={() => setNoting(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
