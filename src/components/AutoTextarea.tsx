import { useLayoutEffect, useRef, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'

// A text field that grows to show everything typed in it, so long entries are never cut off.
// By default Enter saves (by leaving the field) and Shift+Enter adds a new line; with `multiline`,
// Enter adds a new line like any text box.
interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  multiline?: boolean
}

export default function AutoTextarea({ multiline, onKeyDown, onInput, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useLayoutEffect(fit)

  const keyDown = (ev: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!multiline && ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault()
      ev.currentTarget.blur()
    }
    onKeyDown?.(ev)
  }

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={1}
      className={`auto-text ${rest.className ?? ''}`}
      onKeyDown={keyDown}
      onInput={(ev) => { fit(); onInput?.(ev) }}
    />
  )
}
