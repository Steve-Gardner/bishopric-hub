import { useEffect } from 'react'
import './modalLock.css'

// While a popup is open the page behind it is held still, and it is put back exactly where it was when the
// popup closes. Without this a phone scrolls the page to bring the box being typed in into view, and the
// person lands somewhere else after closing.
export function useModalScrollLock() {
  useEffect(() => {
    let y = 0
    let locked = false
    const sync = () => {
      const want = !!document.querySelector('.modal')
      if (want && !locked) {
        y = window.scrollY
        locked = true
        document.body.classList.add('modal-open')
        document.body.style.top = `-${y}px`
      } else if (!want && locked) {
        locked = false
        document.body.classList.remove('modal-open')
        document.body.style.top = ''
        window.scrollTo(0, y)
      }
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); if (locked) { document.body.classList.remove('modal-open'); document.body.style.top = '' } }
  }, [])
}
