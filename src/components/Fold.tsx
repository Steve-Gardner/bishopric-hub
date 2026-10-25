import { useState, type ReactNode } from 'react'

interface Props {
  id: string // remembered while the app is open, so sections stay as the viewer left them; all start closed on a fresh load
  title: ReactNode
  count?: number
  red?: boolean // draw the header as a deep-red banner
  action?: ReactNode // a button or link shown in the header, beside the count
  children: ReactNode
}

export const key = (id: string) => `bishopric.fold.${id}`

// Every section starts closed when the page is loaded. What was open is forgotten here, once, before any
// section is drawn; after that the open/closed choices are remembered while moving between screens.
try {
  Object.keys(localStorage).filter((k) => k.startsWith('bishopric.fold.')).forEach((k) => localStorage.removeItem(k))
} catch { /* private mode */ }

function readOpen(id: string): boolean {
  try {
    return localStorage.getItem(key(id)) === '1'
  } catch {
    return false
  }
}

// A collapsible section. Its contents are only mounted once it has been opened,
// so a page with many sections stays light.
export default function Fold({ id, title, count, red, action, children }: Props) {
  const [open, setOpen] = useState(() => readOpen(id))
  const [everOpen, setEverOpen] = useState(open)

  return (
    <details
      data-fold={id}
      className={`fold ${red ? 'fold-red' : ''}`}
      open={open}
      onToggle={(ev) => {
        const next = ev.currentTarget.open
        setOpen(next)
        if (next) setEverOpen(true)
        try { localStorage.setItem(key(id), next ? '1' : '0') } catch { /* private mode */ }
      }}
    >
      <summary>
        <span>{title}</span>
        {count ? <span className="count">{count}</span> : null}
        {action}
      </summary>
      {everOpen && children}
    </details>
  )
}
