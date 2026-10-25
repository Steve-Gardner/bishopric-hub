import Fold from '../../components/Fold'
import ListEditor from '../../components/ListEditor'

export const ORGS: [string, string][] = [
  ['org:ym', 'Young Men'],
  ['org:yw', 'Young Women'],
  ['org:primary', 'Primary'],
  ['org:ss', 'Sunday School'],
  ['org:rs', 'Relief Society'],
  ['org:eq', 'Elders Quorum'],
  ['org:callings-for', 'Callings to extend (names)'],
]

interface Props {
  counts: Record<string, number>
  onChange: () => void
}

// One collapsible per organization, each with its own notes and needs.
export default function OrgNotesSection({ counts, onChange }: Props) {
  return (
    <>
      {ORGS.map(([key, label]) => (
        <Fold key={key} id={`agenda-${key}`} title={label} count={counts[key]}>
          <ListEditor notes listKey={key} placeholder={`Note for ${label}`} onChange={onChange} />
        </Fold>
      ))}
    </>
  )
}
