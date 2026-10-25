import { useEffect, type RefObject } from 'react'

// Calls `close` when the viewer taps outside `ref` or presses Escape, while `open` is true.
// Used by the small pop-up menus.
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const away = (ev: MouseEvent) => { if (!ref.current?.contains(ev.target as Node)) close() }
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close() }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [ref, open, close])
}
