import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import AutoTextarea from '../../components/AutoTextarea'
import Fold from '../../components/Fold'
import ListEditor from '../../components/ListEditor'
import { useAgendaCounts } from '../../components/useAgendaCounts'
import { useBlocker } from '../../components/useBlocker'
import { peopleIn, personLabel } from '../../data/conflicts'
import { carryForward } from '../../data/carry'
import { nameFor } from '../../data/conducting'
import { staffSuggestions } from '../../components/useStaff'
import { councilAssignmentStore, councilStore, memberStore, staffStore } from '../../data/store'
import type { CouncilAssignment, CouncilEntry, CouncilKind } from '../../data/types'
import AgendaPopups from './AgendaPopups'
import CouncilNeeds from './CouncilNeeds'
import CouncilRoles from './CouncilRoles'
import ScheduleAndEvents from './ScheduleAndEvents'

// The parts of the meeting that have someone assigned, in the order the agenda lists them.
const ROLES: [string, string][] = [
  ['conducting', 'Conducting'],
  ['opening-prayer', 'Opening Prayer'],
  ['gratitude', 'Gratitude & Scripture'],
  ['roles', 'Roles & Responsibilities'],
  ['concluding', 'Concluding Remarks'],
  ['closing-prayer', 'Closing Prayer'],
]

const REPORTS: [string, string][] = [
  ['rs', 'Relief Society'],
  ['yw', 'Young Women'],
  ['primary', 'Primary'],
  ['elders', 'Elders'],
  ['ss', 'Sunday School'],
  ['ym', 'Young Men'],
  ['temple-fh', 'Temple & Family History'],
  ['missionary', 'Missionary'],
  ['stake', 'Stake'],
  ['activities', 'Activities Committee'],
]

const ITEMS = 'council:items'

interface Props {
  date: string
  prevOf: (date: string) => string
}

export default function CouncilAgenda({ date, prevOf }: Props) {
  const { counts, refresh } = useAgendaCounts()
  const { block, dialog } = useBlocker()
  const [entries, setEntries] = useState<CouncilEntry[]>([])
  const [assigned, setAssigned] = useState<CouncilAssignment | undefined>()
  const [staff, setStaff] = useState<Record<string, string>>({})
  const [memberNames, setMemberNames] = useState<string[]>([])
  const [version, setVersion] = useState(0)
  const [moved, setMoved] = useState(0)

  const reload = useCallback(async () => {
    setEntries((await councilStore.list()).filter((e) => e.date === date))
    setAssigned((await councilAssignmentStore.list()).find((a) => a.date === date))
    setStaff(Object.fromEntries((await staffStore.list()).map((p) => [p.id, p.name])))
    setMemberNames((await memberStore.list()).map((m) => m.name).sort())
  }, [date])
  useEffect(() => { reload() }, [reload])

  // The Bishop conducts and gives the concluding remarks, and the gratitude and the roles and responsibilities
  // come from the assignments made in Setup, unless someone else is entered for this meeting.
  const bishop = nameFor('bishop', staff)
  const defaultRole = (key: string) => {
    if (key === 'conducting' || key === 'concluding') return bishop
    if (key === 'gratitude') return assigned?.gratitude ?? ''
    if (key === 'roles') return assigned?.roles ?? ''
    return ''
  }
  const roleValue = (key: string) => {
    const saved = entries.find((e) => e.kind === 'role' && e.key === key)
    return saved ? saved.text : defaultRole(key)
  }
  const roleValues = Object.fromEntries(ROLES.map(([key]) => [key, roleValue(key)]))
  const suggestions = [...new Set([...staffSuggestions(staff), ...memberNames].filter(Boolean))]

  // Returns false when the change was blocked. Nobody can have two parts at the same meeting, except that the
  // person who conducts also gives the concluding remarks. Only a part that was just changed is checked, so
  // an older overlap in the defaults never blocks an unrelated edit.
  const saveRoles = async (draft: Record<string, string>): Promise<boolean> => {
    const clashes: string[] = []
    for (const [i, [a, labelA]] of ROLES.entries()) {
      for (const [b, labelB] of ROLES.slice(i + 1)) {
        if ((a === 'conducting' && b === 'concluding') || (draft[a] ?? '') === roleValues[a] && (draft[b] ?? '') === roleValues[b]) continue
        const shared = peopleIn(draft[a], staff).filter((p) => peopleIn(draft[b], staff).includes(p))
        if (shared.length) clashes.push(`${personLabel(shared[0], staff)} can't be both ${labelA} and ${labelB} at this meeting.`)
      }
    }
    if (clashes.length) { block(clashes); return false }
    for (const [key] of ROLES) {
      const text = (draft[key] ?? '').trim()
      const id = `role:${date}:${key}`
      const def = defaultRole(key)
      if (text === def) await councilStore.remove(id) // same as the default: nothing to store
      else await councilStore.save({ id, date, kind: 'role', key, text }) // a blank replaces a default on purpose
    }
    reload()
    return true
  }
  const resetRoles = async () => {
    await Promise.all(ROLES.map(([key]) => councilStore.remove(`role:${date}:${key}`)))
    reload()
  }

  const get = (kind: CouncilKind, key: string) => entries.find((e) => e.kind === kind && e.key === key)?.text ?? ''
  const set = async (kind: CouncilKind, key: string, text: string) => {
    const id = `${kind}:${date}:${key}`
    if (text.trim()) await councilStore.save({ id, date, kind, key, text: text.trim() })
    else await councilStore.remove(id)
    reload()
  }

  // Unfinished agenda items from the previous meeting move into this one automatically.
  useEffect(() => {
    let alive = true
    setMoved(0)
    carryForward({ type: 'council', keys: [ITEMS], date, prevOf, today: format(new Date(), 'yyyy-MM-dd') }).then((n) => {
      if (!alive) return
      setMoved(n)
      refresh()
      setVersion((v) => v + 1)
    })
    return () => { alive = false }
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const reportCount = entries.filter((e) => e.kind === 'report' && e.text.trim()).length

  return (
    <>
      {moved > 0 && <p role="status" className="muted small carried-note">{moved} unfinished item{moved === 1 ? '' : 's'} carried over from the previous meeting.</p>}

      <AgendaPopups onChange={refresh} />

      {dialog}
      <CouncilRoles roles={ROLES} values={roleValues} suggestions={suggestions} onSave={saveRoles} onReset={resetRoles} />

      <Fold red id="council-needs" title="Individual and Family Needs" count={counts['council-individuals']}>
        <CouncilNeeds onChange={refresh} />
      </Fold>

      <div key={`items-${date}-${version}`}>
        <Fold red id="council-items" title="Agenda Items" count={counts[`${ITEMS}@${date}`]}>
          <ListEditor notes listKey={`${ITEMS}@${date}`} placeholder="Add an agenda item" checkable onChange={refresh} />
        </Fold>
      </div>

      <Fold red id="council-reports" title="Organization Reports" count={reportCount}>
        <div className="org-reports">
          <table className="grid-table">
            <thead><tr><th>Organization</th><th>Report</th></tr></thead>
            <tbody>
              {REPORTS.map(([key, label]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>
                    <AutoTextarea
                      multiline
                      key={date + key + get('report', key)}
                      aria-label={`${label} report`}
                      defaultValue={get('report', key)}
                      onBlur={(ev) => ev.target.value.trim() !== get('report', key) && set('report', key, ev.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Fold>

      <div className="card banner-card">
        <h2 className="banner-head">Extra Notes</h2>
        <div className="banner-body">
          <AutoTextarea
            multiline
            className="extra-notes"
            key={date + get('notes', 'extra')}
            aria-label="Extra notes"
            placeholder="Notes from the meeting…"
            defaultValue={get('notes', 'extra')}
            onBlur={(ev) => ev.target.value.trim() !== get('notes', 'extra') && set('notes', 'extra', ev.target.value)}
          />
        </div>
      </div>

      <hr className="day-divider double" />

      <ScheduleAndEvents date={date} schedule={false} />
    </>
  )
}
