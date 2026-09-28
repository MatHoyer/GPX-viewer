export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 2 : 1)} km`
}

export function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/** A cached formatter; an undefined timeZone is the viewer's. */
function formatter(style: 'date' | 'time', timeZone?: string): Intl.DateTimeFormat {
  const key = `${style}|${timeZone ?? ''}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, style === 'date' ? { dateStyle: 'medium', timeZone } : { timeStyle: 'short', timeZone })
    formatters.set(key, f)
  }
  return f
}

export function formatDate(iso: string | null, timeZone?: string): string | null {
  return iso ? formatter('date', timeZone).format(new Date(iso)) : null
}

export function formatTime(date: Date, timeZone?: string): string {
  return formatter('time', timeZone).format(date)
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** How long ago iso was, e.g. "5 minutes ago"; under a minute is "just now". */
export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000
  for (const [unit, size] of relativeUnits) {
    if (Math.abs(seconds) >= size) return relativeFormatter.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}
