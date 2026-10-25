import { useMemo, type ReactNode } from 'react'
import { fmtRange } from '../../data/format'
import { ROLES } from '../../data/roles'
import { PRESIDENCY_COLUMNS, layoutSchedule, type ScheduleItem } from '../../data/todaySchedule'

interface Props {
  items: ScheduleItem[]
  names: Record<string, string>
  only?: number // show just this person's column (0 Bishop, 1 first counselor, 2 second counselor), full width
  extra?: (item: ScheduleItem) => ReactNode // something added to an item, such as an Agenda button
  onOpen?: (item: ScheduleItem) => void // called when an item is tapped
}

// A day for the bishop and his counselors, one column each. Something several of them attend crosses their
// columns. With `only`, the grid is a single column holding everything that person has.
export default function ScheduleGrid({ items, names, only, extra, onOpen }: Props) {
  const columns = only === undefined ? [0, 1, 2] : [only]
  const placed = useMemo(() => {
    const shown = items
      .filter((i) => i.columns.some((c) => columns.includes(c)))
      .map((i) => (only === undefined ? i : { ...i, columns: [0] }))
    return layoutSchedule(shown)
  }, [items, only]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = placed.reduce((m, p) => Math.max(m, p.row), 0) + 1 // the header row and every row of items

  return (
    <div className="today-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
      {columns.map((c, i) => (
        <div key={`lane-${c}`} className={`lane lane-${c}`} style={{ gridColumn: i + 1, gridRow: `1 / span ${rows}` }} aria-hidden="true" />
      ))}
      {columns.map((c, i) => {
        const role = PRESIDENCY_COLUMNS[c]
        return (
          <div key={role} className="today-head" style={{ gridColumn: i + 1, gridRow: 1 }}>
            <strong>{ROLES.find((r) => r.key === role)?.label}</strong>
            {names[role]?.trim() && <span className="muted small">{names[role]}</span>}
          </div>
        )
      })}
      {placed.map((p) => (
        <div
          key={`${p.item.id}:${p.column}`}
          className={`today-item ${onOpen && p.item.source === 'event' ? 'clickable' : ''}`}
          style={{ gridColumn: `${p.column + 1} / span ${p.span}`, gridRow: p.row + 1 }}
          onClick={onOpen && p.item.source === 'event' ? () => onOpen(p.item) : undefined}
        >
          {p.item.start && <span className="today-time">{fmtRange(p.item.start, p.item.end)}</span>}
          <strong>{p.item.title}</strong>
          {p.item.detail && <span className="muted small">{p.item.detail}</span>}
          {extra?.(p.item)}
        </div>
      ))}
    </div>
  )
}
