import { useEffect, useState } from 'react'
import { listStore } from '../data/store'
import AutoTextarea from './AutoTextarea'
import type { ListItem } from '../data/types'

interface Props {
  listKey: string
  title?: string
  placeholder?: string
  checkable?: boolean // show checkboxes and a "clear completed" button
  tableLike?: boolean // draw the rows as a bordered table
  notes?: boolean // give each item a notes button
  suggestions?: string[] // names offered as the viewer types
  onChange?: () => void // called after the viewer adds, edits, removes, or reorders something
}

export default function ListEditor({ listKey, title, placeholder = 'Add item', checkable, tableLike, notes, suggestions, onChange }: Props) {
  const [items, setItems] = useState<ListItem[]>([])
  const [text, setText] = useState('')
  const [noting, setNoting] = useState<ListItem | null>(null)
  const [draft, setDraft] = useState('')

  const reload = async () =>
    setItems((await listStore.list()).filter((i) => i.list === listKey).sort((a, b) => a.order - b.order))
  useEffect(() => { reload() }, [listKey])
  const changed = async () => { await reload(); onChange?.() }

  const add = async () => {
    const t = text.trim()
    if (!t) return
    const order = items.length ? Math.max(...items.map((i) => i.order)) + 1 : 0
    await listStore.save({ id: crypto.randomUUID(), list: listKey, text: t, order, done: checkable ? false : undefined })
    setText('')
    changed()
  }
  const patch = async (i: ListItem, p: Partial<ListItem>) => { await listStore.save({ ...i, ...p }); changed() }
  const remove = async (i: ListItem) => { await listStore.remove(i.id); changed() }
  const move = async (idx: number, dir: -1 | 1) => {
    const a = items[idx], b = items[idx + dir]
    if (!a || !b) return
    await listStore.save({ ...a, order: b.order })
    await listStore.save({ ...b, order: a.order })
    changed()
  }
  const clearDone = async () => {
    await Promise.all(items.filter((i) => i.done).map((i) => listStore.remove(i.id)))
    changed()
  }
  const openNotes = (i: ListItem) => { setNoting(i); setDraft(i.notes ?? '') }
  const saveNotes = async () => {
    if (!noting) return
    await patch(noting, { notes: draft.trim() || undefined })
    setNoting(null)
  }
  const doneCount = items.filter((i) => i.done).length

  return (
    <div className={`card ${tableLike ? 'table-like' : ''}`}>
      {title && <h2>{title}</h2>}
      <ul className="plain">
        {items.map((i, idx) => (
          <li key={i.id} className="list-item">
            {checkable && (
              <input type="checkbox" className="check" checked={!!i.done} onChange={() => patch(i, { done: !i.done })} aria-label="Done" />
            )}
            <AutoTextarea
              className={checkable && i.done ? 'done' : ''}
              key={i.text}
              defaultValue={i.text}
              onBlur={(ev) => {
                const v = ev.target.value.trim()
                if (!v) remove(i)
                else if (v !== i.text) patch(i, { text: v })
              }}
            />
            {notes && (
              <button
                className={`icon-btn notes-btn ${i.notes ? 'has' : ''}`}
                onClick={() => openNotes(i)}
                aria-label={i.notes ? 'Notes (has notes)' : 'Notes'}
                title={i.notes ? 'View or edit notes' : 'Add notes'}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <path d="M14 3v6h6" />
                  <path d="M8 13h8" />
                  <path d="M8 17h5" />
                </svg>
              </button>
            )}
            <span className="row-actions">
              <button disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Move up">↑</button>
              <button disabled={idx === items.length - 1} onClick={() => move(idx, 1)} aria-label="Move down">↓</button>
              <button className="danger" onClick={() => remove(i)} aria-label="Remove">✕</button>
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="muted">Nothing here yet.</li>}
      </ul>
      <form className="row add-row" onSubmit={(ev) => { ev.preventDefault(); add() }}>
        <input value={text} list={suggestions ? `suggest-${listKey}` : undefined} onChange={(ev) => setText(ev.target.value)} placeholder={placeholder} />
        {suggestions && <datalist id={`suggest-${listKey}`}>{suggestions.map((n) => <option key={n} value={n} />)}</datalist>}
        <button type="submit" className="primary" disabled={!text.trim()}>Add</button>
      </form>
      {checkable && doneCount > 0 && (
        <button style={{ marginTop: 8 }} onClick={clearDone}>Clear {doneCount} completed</button>
      )}
      {noting && (
        <div className="modal" onClick={() => setNoting(null)}>
          <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); saveNotes() }}>
            <h2>Notes: {noting.text}</h2>
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
    </div>
  )
}
