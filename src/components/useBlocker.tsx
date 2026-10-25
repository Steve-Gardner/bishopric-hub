import { useState, type ReactNode } from 'react'

// A blocking notice: "block(messages)" stops what the person was doing and says why. Render `dialog` once
// in the component. There is no way around it; the person changes the booking and tries again.
export function useBlocker(): { block: (messages: string[]) => void; dialog: ReactNode } {
  const [messages, setMessages] = useState<string[]>([])
  const dialog = messages.length > 0 && (
    <div className="modal blocker-modal" onClick={(ev) => { ev.stopPropagation(); setMessages([]) }}>
      <div className="sheet popup blocker" role="alertdialog" aria-modal="true" aria-label="Double booking" onClick={(ev) => ev.stopPropagation()}>
        <h2>Double booking</h2>
        <p className="muted">That can't be saved because someone would be in two places at once.</p>
        <ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul>
        <div className="row actions">
          <button className="primary" autoFocus onClick={() => setMessages([])}>OK</button>
        </div>
      </div>
    </div>
  )
  return { block: (m) => setMessages(m), dialog }
}
