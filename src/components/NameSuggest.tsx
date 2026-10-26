import { useMemo, useRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  names: string[]
  placeholder?: string
  autoFocus?: boolean
}

// A name box whose suggestions are listed right under it, in the page, instead of in the browser's floating list. That
// list is hidden behind the phone's keyboard; this one is not, and the box scrolls to the top of the screen when
// tapped so the suggestions sit above the keyboard.
export default function NameSuggest({ value, onChange, names, placeholder, autoFocus }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    const parts = q.split(/\s+/)
    return names
      .filter((n) => n.toLowerCase() !== q && parts.every((p) => n.toLowerCase().includes(p)))
      .sort((a, b) => Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)) || a.localeCompare(b))
      .slice(0, 6)
  }, [value, names])

  return (
    <>
      <input
        ref={ref}
        className="name-suggest"
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        value={value}
        placeholder={placeholder}
        onChange={(ev) => onChange(ev.target.value)}
        onFocus={() => window.setTimeout(() => ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250)}
      />
      {matches.length > 0 && (
        <ul className="suggest-list" role="listbox">
          {matches.map((n) => (
            <li key={n}><button type="button" role="option" aria-selected="false" onClick={() => onChange(n)}>{n}</button></li>
          ))}
        </ul>
      )}
    </>
  )
}
