import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

interface Props<T extends { id: string }> {
  items: T[]
  // Draws one row. `handle` is the grip to drag by; put it where it should show in the row.
  render: (item: T, handle: ReactNode) => ReactNode
  onReorder: (ids: string[]) => void
}

interface Drag {
  id: string
  y: number // where the pointer is
  grab: number // how far down the row the pointer took hold
  left: number
  width: number
  height: number
  over: number // the place the row will land among the other rows
}

// A list whose rows are dragged by their grip, with a mouse or a finger. While one is held it floats under the
// pointer and a gap opens where it will land. The grip also takes the up and down arrow keys.
export default function ReorderList<T extends { id: string }>({ items, render, onReorder }: Props<T>) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const reorderRef = useRef(onReorder)
  reorderRef.current = onReorder
  const live = drag?.id

  const update = (d: Drag | null) => { dragRef.current = d; setDrag(d) }

  useEffect(() => {
    if (!live) return
    const move = (ev: globalThis.PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-reorder-id]:not([data-dragging])') ?? [])]
      const over = rows.filter((el) => { const r = el.getBoundingClientRect(); return ev.clientY > r.top + r.height / 2 }).length
      update({ ...d, y: ev.clientY, over })
    }
    const end = () => {
      const d = dragRef.current
      update(null)
      if (!d) return
      const ids = itemsRef.current.map((i) => i.id)
      const next = ids.filter((id) => id !== d.id)
      next.splice(d.over, 0, d.id)
      if (next.join() !== ids.join()) reorderRef.current(next)
    }
    const cancel = (ev: KeyboardEvent | globalThis.KeyboardEvent) => { if (ev.key === 'Escape') update(null) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', () => update(null))
    window.addEventListener('keydown', cancel as EventListener)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('keydown', cancel as EventListener)
    }
  }, [live])

  const start = (ev: PointerEvent<HTMLElement>, id: string) => {
    if (ev.button > 0) return
    ev.preventDefault()
    const row = ev.currentTarget.closest<HTMLElement>('[data-reorder-id]')
    if (!row) return
    const r = row.getBoundingClientRect()
    update({ id, y: ev.clientY, grab: ev.clientY - r.top, left: r.left, width: r.width, height: r.height, over: items.findIndex((i) => i.id === id) })
  }
  const key = (ev: KeyboardEvent<HTMLElement>, index: number) => {
    const to = ev.key === 'ArrowUp' ? index - 1 : ev.key === 'ArrowDown' ? index + 1 : -1
    if (to < 0 || to >= items.length) return
    ev.preventDefault()
    const ids = items.map((i) => i.id)
    ;[ids[index], ids[to]] = [ids[to], ids[index]]
    onReorder(ids)
    // Keep the grip focused after the row moves, so the arrow keys can carry on.
    const id = items[index].id
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-reorder-id="${id}"] .grip`)?.focus())
  }

  const handleFor = (item: T, index: number) => (
    <span
      className="grip"
      role="button"
      tabIndex={0}
      aria-label="Drag to reorder (or use the up and down arrow keys)"
      title="Drag to reorder"
      onPointerDown={(ev) => start(ev, item.id)}
      onKeyDown={(ev) => key(ev, index)}
    >
      <svg viewBox="0 0 12 18" width="12" height="18" aria-hidden="true">
        {[3, 9, 15].map((y) => <g key={y}><circle cx="3" cy={y} r="1.6" /><circle cx="9" cy={y} r="1.6" /></g>)}
      </svg>
    </span>
  )

  const others = items.map((item, index) => ({ item, index })).filter((x) => x.item.id !== drag?.id)
  const held = drag ? items.findIndex((i) => i.id === drag.id) : -1
  const rows: ReactNode[] = others.map(({ item, index }) => (
    <div className="reorder-row" data-reorder-id={item.id} key={item.id}>{render(item, handleFor(item, index))}</div>
  ))
  if (drag) rows.splice(drag.over, 0, <div className="drop-gap" key="gap" style={{ height: drag.height }} aria-hidden="true" />)

  return (
    <div className={`reorder-list${drag ? ' is-dragging' : ''}`} ref={listRef}>
      {rows}
      {drag && held >= 0 && (
        <div
          className="reorder-row floating"
          data-reorder-id={drag.id}
          data-dragging=""
          key={drag.id}
          style={{ position: 'fixed', top: drag.y - drag.grab, left: drag.left, width: drag.width, zIndex: 80 }}
        >
          {render(items[held], handleFor(items[held], held))}
        </div>
      )}
    </div>
  )
}
