import { useEffect, useRef, useState } from 'react'

// Shown every time the page loads or is refreshed, and never for people who ask for reduced motion.
// (This component stays mounted, so moving between screens does not bring it back.)
function shouldShow(): boolean {
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export default function Splash() {
  const [phase, setPhase] = useState<'show' | 'leaving' | 'gone'>(() => (shouldShow() ? 'show' : 'gone'))

  // "5th" is centered as one piece: the 5 and the raised "th" are measured together and the pair is shifted
  // so the middle of the whole word sits on the middle of the ring.
  const word = useRef<SVGGElement>(null)
  useEffect(() => {
    if (phase !== 'show') return
    const center = () => {
      const g = word.current
      if (!g) return
      g.removeAttribute('transform')
      const box = g.getBBox()
      g.setAttribute('transform', `translate(${(100 - (box.x + box.width / 2)).toFixed(1)} 0)`)
    }
    center()
    document.fonts?.ready.then(center)
  }, [phase])

  const dismiss = () => {
    setPhase('leaving')
    window.setTimeout(() => setPhase('gone'), 500)
  }

  useEffect(() => {
    if (phase !== 'show') return
    const t = window.setTimeout(dismiss, 3800)
    return () => window.clearTimeout(t)
  }, [phase])

  if (phase === 'gone') return null

  return (
    <div className={`splash ${phase === 'leaving' ? 'leaving' : ''}`} onClick={dismiss} role="presentation">
      <svg className="splash-mark" viewBox="0 0 200 200" aria-hidden="true">
        <circle className="ring ring-outer" cx="100" cy="100" r="86" />
        <circle className="ring ring-inner" cx="100" cy="100" r="70" />
        <g ref={word}>
          <text className="five" x="100" y="128" textAnchor="middle">5</text>
          <text className="th" x="132" y="86" textAnchor="start">th</text>
        </g>
      </svg>
      <h1 className="splash-title">5th Ward</h1>
      <p className="splash-sub">Bishopric Hub</p>
      <span className="splash-rule" />
    </div>
  )
}
