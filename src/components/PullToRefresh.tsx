import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { refreshData } from '../data/cloud'

const TRIGGER = 70 // how far to pull, in pixels, before letting go refreshes
const MAX = 110

// Pull the page down from the very top to load the latest data. A round arrow follows the finger, turns
// when it is far enough, and spins while the data loads.
export default function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const start = useRef<number | null>(null)
  const pullRef = useRef(0)
  const busyRef = useRef(false)

  useEffect(() => {
    const set = (n: number) => { pullRef.current = n; setPull(n) }
    const onStart = (e: TouchEvent) => {
      const scrolled = window.scrollY > 0 || !!document.querySelector('.modal')
      start.current = scrolled || busyRef.current ? null : e.touches[0].clientY
    }
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return
      const dy = e.touches[0].clientY - start.current
      if (dy <= 0) { if (pullRef.current) set(0); return }
      if (window.scrollY > 0) { start.current = null; set(0); return }
      if (e.cancelable) e.preventDefault()
      set(Math.min(MAX, dy * 0.5))
    }
    const onEnd = async () => {
      if (start.current === null) return
      start.current = null
      if (pullRef.current >= TRIGGER) {
        busyRef.current = true
        setBusy(true)
        set(TRIGGER)
        try { await refreshData() } catch { /* keep what is on the screen */ }
        busyRef.current = false
        setBusy(false)
      }
      set(0)
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // The whole page slides down with the finger, which uncovers the black space the arrow sits in.
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    root.style.transition = pull === 0 || busy ? 'transform .2s ease' : 'none'
    root.style.transform = pull ? `translateY(${pull}px)` : ''
    if (!pull) { const t = window.setTimeout(() => { root.style.transition = '' }, 250); return () => window.clearTimeout(t) }
  }, [pull, busy])

  if (pull === 0 && !busy) return null
  const ready = pull >= TRIGGER
  return createPortal(
    <div className="ptr" style={{ height: pull, opacity: Math.min(1, pull / 40) }} aria-live="polite">
      <div className={`ptr-bubble ${busy ? 'spin' : ''}`}>
        {busy ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${ready ? 180 : 0}deg)`, transition: 'transform .15s' }}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        )}
      </div>
      <span className="ptr-text">{busy ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}</span>
    </div>,
    document.body,
  )
}
