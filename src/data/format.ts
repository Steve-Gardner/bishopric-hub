import { format } from 'date-fns'

// "19:00" -> "7:00 PM"
export function fmtTime(time?: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  return format(new Date(2000, 0, 1, h, m), 'h:mm a')
}

export const toIso = (d: Date) => format(d, 'yyyy-MM-dd')

// The next Sunday on or after today, as yyyy-MM-dd.
export function nextSundayIso(): string {
  const now = new Date()
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay()) % 7))
  return format(sunday, 'yyyy-MM-dd')
}

// "8:15 AM – 9:15 AM", just the start when there is no end, or an empty string with no times.
export function fmtRange(start?: string, end?: string): string {
  if (!start) return ''
  return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start)
}
