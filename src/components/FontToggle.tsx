import { useState } from 'react'

const KEY = 'bishopric.dyslexiaFont'

export function readFontPref(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function applyFontPref(on: boolean) {
  document.documentElement.classList.toggle('dys', on)
}

// A slide switch that changes the whole app to OpenDyslexic with looser spacing.
// The choice is remembered per device.
export default function FontToggle() {
  const [on, setOn] = useState(readFontPref)

  const toggle = () => {
    const next = !on
    setOn(next)
    applyFontPref(next)
    try { localStorage.setItem(KEY, next ? '1' : '0') } catch { /* private mode */ }
  }

  return (
    <button role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} onClick={toggle}>
      <span className="switch-label">Dyslexia font</span>
      <span className="track" aria-hidden="true"><span className="thumb" /></span>
    </button>
  )
}
