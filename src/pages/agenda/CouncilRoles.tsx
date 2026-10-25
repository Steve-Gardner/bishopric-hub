import { useState } from 'react'

interface Props {
  roles: [string, string][] // key, label
  values: Record<string, string> // what each role shows now (a saved name, or the default)
  suggestions: string[] // names offered while typing
  onSave: (draft: Record<string, string>) => Promise<boolean | void> // false: blocked, keep the sheet open
  onReset: () => Promise<void>
}

// Who is doing what at this meeting. Names read as plain text; the pencil opens one sheet to change them.
export default function CouncilRoles({ roles, values, suggestions, onSave, onReset }: Props) {
  const [draft, setDraft] = useState<Record<string, string> | null>(null)

  const save = async () => {
    if (!draft) return
    if ((await onSave(draft)) === false) return
    setDraft(null)
  }

  return (
    <>
      <div className="card gratitude">
        <div className="gratitude-title">
          <h2>Meeting Roles</h2>
          <button className="icon-btn" onClick={() => setDraft({ ...values })} aria-label="Edit meeting roles" title="Edit who is doing what">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </div>
        <dl className="role-list">
          {roles.map(([key, label]) => (
            <div key={key} className="role-view">
              <dt>{label}</dt>
              <dd>{values[key] || <span className="muted">Not assigned</span>}</dd>
            </div>
          ))}
        </dl>
      </div>

      {draft && (
        <div className="modal" onClick={() => setDraft(null)}>
          <form className="sheet" onClick={(ev) => ev.stopPropagation()} onSubmit={(ev) => { ev.preventDefault(); save() }}>
            <h2>Meeting roles</h2>
            {roles.map(([key, label]) => (
              <label key={key}>{label}
                <input
                  list="role-names"
                  value={draft[key] ?? ''}
                  onChange={(ev) => setDraft({ ...draft, [key]: ev.target.value })}
                />
              </label>
            ))}
            <datalist id="role-names">{suggestions.map((n) => <option key={n} value={n} />)}</datalist>
            <div className="row actions">
              <button type="submit" className="primary">Save</button>
              <button type="button" onClick={() => setDraft(null)}>Cancel</button>
              <button type="button" className="danger" onClick={async () => { await onReset(); setDraft(null) }}>Reset to defaults</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
