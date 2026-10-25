import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/opendyslexic/400.css'
import '@fontsource/opendyslexic/700.css'
import './index.css'
import { applyFontPref, readFontPref } from './components/FontToggle.tsx'
import Root from './Root.tsx'

// Remove data left behind by sections that no longer exist (Spiritual Thoughts, the old monthly rotation, added meetings).
// (bishopric.myRole is NOT here: This Device in Setup uses that key again.)
try {
  ;['bishopric.presenters', 'bishopric.thoughts', 'bishopric.months', 'bishopric.sacramentMeetings'].forEach((k) => localStorage.removeItem(k))
} catch { /* private mode */ }

// Apply before first paint so there's no flash of the wrong font.
applyFontPref(readFontPref())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
