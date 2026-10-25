import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { exportBackup, importBackup } from '../data/backup'
import { cloudEnabled } from '../data/cloud'
import Fold from '../components/Fold'
import { useOpenFromLink } from '../components/useOpenFromLink'
import MyRoleSetup from './setup/MyRoleSetup'
import AccountSetup from './setup/AccountSetup'
import RolesSetup from './setup/RolesSetup'
import WardMembersSetup from './setup/WardMembersSetup'
import YouthRosterSetup from './setup/YouthRosterSetup'

export default function Setup() {
  useOpenFromLink() // a link can ask for one section to be open (?open=...)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const download = async () => {
    const blob = new Blob([await exportBackup()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bishopric-hub-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Backup downloaded.')
  }
  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      if (!confirm('Restoring replaces everything currently in the app with the backup. Continue?')) return
      const n = await importBackup(text)
      setMessage(`Restored ${n} records.`)
      location.hash = '#/'
      location.reload()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not restore that file.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section>
      <h1>Setup</h1>

      <Fold red id="setup-roles" title="Roles">
        <div className="fold-pad"><RolesSetup /></div>
      </Fold>

      <Fold red id="setup-my-role" title="This Device">
        <div className="fold-pad"><MyRoleSetup /></div>
      </Fold>

      <Fold red id="setup-ward-members" title="Ward Members">
        <div className="fold-pad"><WardMembersSetup /></div>
      </Fold>

      <Fold red id="setup-youth-roster" title="Youth Roster">
        <div className="fold-pad"><YouthRosterSetup /></div>
      </Fold>

      {cloudEnabled && (
        <Fold red id="setup-account" title="Account & Shared Data">
          <div className="fold-pad"><AccountSetup /></div>
        </Fold>
      )}

      <Fold red id="setup-backup" title="Backup & Restore">
        <div className="fold-pad">
          <p className="muted">
            Everything is stored in this browser only. Export a backup to keep a copy or to move your data to another
            browser or device, then restore it there.
          </p>
          <div className="row actions">
            <button className="primary" onClick={download}>Export backup</button>
            <button onClick={() => fileRef.current?.click()}>Restore from file</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(ev) => restore(ev.target.files?.[0])} />
          {message && <p role="status">{message}</p>}
        </div>
      </Fold>
    </section>
  )
}
