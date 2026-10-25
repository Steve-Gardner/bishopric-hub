import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import Agenda from './pages/Agenda'
import Calendar from './pages/calendar/Calendar'
import FontToggle from './components/FontToggle'
import EventAgenda from './pages/EventAgenda'
import Fsy from './pages/Fsy'
import Home, { SECTIONS } from './pages/Home'
import Schedule from './pages/Schedule'
import Sacrament from './pages/Sacrament'
import Setup from './pages/Setup'
import Splash from './components/Splash'
import { useDataVersion } from './data/cloud'

// House icon in the header, shown on every screen.
function HomeIcon() {
  return (
    <NavLink to="/" end className="home-icon" aria-label="Home" title="Home">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9.5a.5.5 0 0 0 .5.5h4v-6h4v6h4a.5.5 0 0 0 .5-.5V10" />
      </svg>
    </NavLink>
  )
}

export default function App() {
  const dataVersion = useDataVersion() // changes when another phone saves something, so the page loads again
  return (
    <HashRouter>
      <Splash />
      <header className="topbar">
        <div className="topline">
          <NavLink to="/" end className="brand">5th Ward Bishopric Hub</NavLink>
          <div className="header-actions">
            <HomeIcon />
            <FontToggle />
          </div>
        </div>
        <nav>
          {SECTIONS.map((s) => <NavLink key={s.to} to={s.to}>{s.label}</NavLink>)}
        </nav>
      </header>
      <main>
        <Routes key={dataVersion}>
          <Route path="/" element={<Home />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/event/:id/agenda" element={<EventAgenda />} />
          <Route path="/sacrament" element={<Sacrament />} />
          <Route path="/blessings" element={<Navigate to="/fsy" replace />} />
          <Route path="/thoughts" element={<Navigate to="/setup" replace />} />
          <Route path="/fsy" element={<Fsy />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/setup" element={<Setup />} />
        </Routes>
      </main>
    </HashRouter>
  )
}
