import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { key } from './Fold'

// A link into a page can name the section it wants with ?open=<section id>. That section opens and the page
// scrolls to it. Call this at the top of the page, before its sections are drawn.
export function useOpenFromLink() {
  const target = useSearchParams()[0].get('open')
  const { key: visit } = useLocation() // changes with every visit, even to the same link
  if (target) {
    try { localStorage.setItem(key(target), '1') } catch { /* private mode */ }
  }
  useEffect(() => {
    if (!target) return
    // The page may already be showing (a link that only changes the section), so open it in place as well.
    const section = document.querySelector<HTMLDetailsElement>(`[data-fold="${target}"]`)
    if (section && !section.open) section.open = true
    const t = window.setTimeout(() => {
      section?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 150)
    return () => window.clearTimeout(t)
  }, [target, visit])
}
