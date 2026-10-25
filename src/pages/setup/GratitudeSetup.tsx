import { useState } from 'react'
import BishopricGratitudeSetup from './BishopricGratitudeSetup'
import CouncilGratitudeSetup from './CouncilGratitudeSetup'

type Tab = 'bishopric' | 'council'

// Who gives the gratitude statement and the roles and responsibilities, for each of the two meetings.
export default function GratitudeSetup() {
  const [tab, setTab] = useState<Tab>('bishopric')

  return (
    <>
      <div className="tabs">
        <button className={tab === 'bishopric' ? 'primary' : ''} onClick={() => setTab('bishopric')}>Bishopric Meeting</button>
        <button className={tab === 'council' ? 'primary' : ''} onClick={() => setTab('council')}>Ward Council</button>
      </div>
      {tab === 'bishopric' ? <BishopricGratitudeSetup /> : <CouncilGratitudeSetup />}
    </>
  )
}
