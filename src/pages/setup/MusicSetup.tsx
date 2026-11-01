import { useEffect, useState } from 'react'
import ListEditor from '../../components/ListEditor'
import { memberStore } from '../../data/store'

// Who plays and who leads the music, offered in the conducting script's Meeting Setup.
export default function MusicSetup() {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => { memberStore.list().then((m) => setNames(m.map((x) => x.name).sort())) }, [])
  return (
    <div className="fold-pad">
      <p className="muted">These names appear in the Organist and Music leader choices in the conducting script.</p>
      <ListEditor listKey="music:organists" title="Organists" placeholder="Add an organist" suggestions={names} />
      <ListEditor listKey="music:leaders" title="Music leaders" placeholder="Add a music leader" suggestions={names} />
    </div>
  )
}
