import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EyeIcon from '../../components/EyeIcon'
import { individualStore } from '../../data/store'
import type { Individual } from '../../data/types'

// The Individual and Family Needs list as the Ward Council sees it: the same people as the Bishopric agenda,
// names only. The bishopric's private notes are never read here, so they can't reach the council or its PDF.
// Hiding someone keeps them off this list (and the PDF) until they are shown again.
export default function CouncilNeeds({ onChange }: { onChange: () => void }) {
  const [people, setPeople] = useState<Individual[]>([])
  const [noting, setNoting] = useState<Individual | null>(null)
  const [draft, setDraft] = useState('')

  const reload = async () => setPeople((await individualStore.list()).sort((a, b) => a.order - b.order))
  useEffect(() => { reload() }, [])

  const toggle = async (p: Individual) => {
    await individualStore.save({ ...p, hideFromCouncil: p.hideFromCouncil ? undefined : true })
    await reload()
    onChange()
  }

  const openNotes = (p: Individual) => { setNoting(p); setDraft(p.councilNotes ?? '') }
  const saveNotes = async () => {
    if (!noting) return
    await individualStore.save({ ...noting, councilNotes: draft.trim() || undefined })
    setNoting(null)
    await reload()
    onChange()
  }
  const notesButton = (p: Individual) => (
    <button
      className={`icon-btn notes-btn ${p.councilNotes ? 'has' : ''}`}
      onClick={() => openNotes(p)}
      aria-label={p.councilNotes ? `Council notes for ${p.name} (has notes)` : `Council notes for ${p.name}`}
      title={p.councilNotes ? 'View or edit notes' : 'Add notes'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <path d="M14 3v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h5" />
              </svg>
    </button>
  )

  const shown = people.filter((p) => !p.hideFromCouncil)
  const hidden = people.filter((p) => p.hideFromCouncil)

  return (
    <>
      <ul className="plain">
        {shown.map((p) => (
          <li key={p.id} className="council-need">
            <span>{p.name}</span>
            {notesButton(p)}
            <button className="icon-btn" onClick={() => toggle(p)} aria-label={`Hide ${p.name} from the Ward Council`} title="Hide from the Ward Council">
              <EyeIcon />
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="muted">No one is shown on the Ward Council list.</li>}
      </ul>

      {hidden.length > 0 && (
        <details className="hidden-needs">
          <summary>{hidden.length} hidden from the Ward Council</summary>
          <ul className="plain">
            {hidden.map((p) => (
              <li key={p.id} className="council-need">
                <span className="muted">{p.name}</span>
                {notesButton(p)}
                <button className="icon-btn hidden-from-council" onClick={() => toggle(p)} aria-label={`${p.name} is hidden. Show on the Ward Council`} title="Hidden. Tap to show.">
                  <EyeIcon off />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="muted small">The list is kept in the <Link to="/agenda">Bishopric Meeting agenda</Link>. The bishopric's private notes are not shown here. Notes you add here are visible to the bishopric.</p>

      {noting && (
        <div className="modal modal-top" onClick={() => setNoting(null)}>
          <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); saveNotes() }}>
            <h2>Notes: {noting.name}</h2>
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
