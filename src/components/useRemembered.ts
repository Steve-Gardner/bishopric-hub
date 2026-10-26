import { useState } from 'react'

// State that survives the page drawing itself again when the data changes (every save does this), so a tab or a
// date the person chose is not thrown away. It is forgotten when they move to another screen, so each screen still
// opens fresh.
const remembered = new Map<string, unknown>()
export const forgetRemembered = () => remembered.clear()

export function useRemembered<T>(key: string, initial: T | (() => T)): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => (remembered.has(key) ? (remembered.get(key) as T) : typeof initial === 'function' ? (initial as () => T)() : initial))
  return [value, (next: T) => { remembered.set(key, next); setValue(next) }]
}
