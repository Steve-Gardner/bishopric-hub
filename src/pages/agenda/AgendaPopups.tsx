import { useState } from 'react'
import { GatheringTable, WardGoals } from './WardTable'

type Popup = 'gathering' | 'goals'

// Two buttons at the top of an agenda. Each opens its list in a pop-up window over the agenda.
export default function AgendaPopups({ onChange }: { onChange: () => void }) {
  const [open, setOpen] = useState<Popup | null>(null)
  const title = open === 'gathering' ? 'Gathering One by One in Christ' : 'Ward Goals'

  return (
    <>
      <div className="popup-buttons">
        <button onClick={() => setOpen('gathering')}>Gathering One by One in Christ</button>
        <button onClick={() => setOpen('goals')}>Ward Goals</button>
      </div>

      {open && (
        <div className="modal popup-modal" onClick={() => setOpen(null)}>
          <div className="sheet popup" role="dialog" aria-modal="true" aria-label={title} onClick={(ev) => ev.stopPropagation()}>
            <div className="popup-head">
              <h2>{title}</h2>
              <button className="icon-btn" onClick={() => setOpen(null)} aria-label="Close">✕</button>
            </div>
            {open === 'gathering' ? <GatheringTable /> : <WardGoals onChange={onChange} />}
          </div>
        </div>
      )}
    </>
  )
}
