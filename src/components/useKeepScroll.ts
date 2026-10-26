import { useEffect, useLayoutEffect, useRef } from 'react'

// When the data changes the page draws itself again from the top, which used to throw the person to the top
// or to a different part of the screen. This remembers where they were and puts them back once the page has
// grown tall enough again, giving up if they start scrolling themselves.
export function useKeepScroll(version: number) {
  const y = useRef(window.scrollY)
  const restoring = useRef(false)
  const first = useRef(true)

  useEffect(() => {
    const track = () => { if (!restoring.current) y.current = window.scrollY }
    const stop = () => { restoring.current = false }
    window.addEventListener('scroll', track, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('wheel', stop, { passive: true })
    return () => {
      window.removeEventListener('scroll', track)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('wheel', stop)
    }
  }, [])

  useLayoutEffect(() => {
    if (first.current) { first.current = false; return }
    const target = y.current
    if (!target) return
    restoring.current = true
    const started = performance.now()
    let frame = 0
    const tick = () => {
      if (!restoring.current) return
      window.scrollTo(0, target)
      const done = Math.abs(window.scrollY - target) < 2
      if (performance.now() - started < 1500 && !(done && performance.now() - started > 400)) frame = requestAnimationFrame(tick)
      else restoring.current = false
    }
    tick()
    return () => { cancelAnimationFrame(frame); restoring.current = false }
  }, [version])
}
