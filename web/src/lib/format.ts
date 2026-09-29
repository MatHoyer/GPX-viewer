import i18n, { currentLanguage } from '@/i18n'

// Formatters follow the UI language, and are cached per language and options.
const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>()

function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>(
  kind: string,
  options: object,
  make: (locale: string) => T,
): T {
  const locale = currentLanguage()
  const key = `${kind}|${locale}|${JSON.stringify(options)}`
  let f = cache.get(key) as T | undefined
  if (!f) {
    f = make(locale)
    cache.set(key, f)
  }
  return f
}

/** A date formatter in the UI language; an undefined timeZone is the viewer's. */
export function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return cached('date', options, (locale) => new Intl.DateTimeFormat(locale, options))
}

export function formatNumber(n: number, options: Intl.NumberFormatOptions = {}): string {
  return cached('number', options, (locale) => new Intl.NumberFormat(locale, options)).format(n)
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${formatNumber(Math.round(meters))} m`
  const digits = meters < 10_000 ? 2 : 1
  return `${formatNumber(meters / 1000, { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`
}

export function formatElevation(meters: number): string {
  return `${formatNumber(Math.round(meters))} m`
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

export function formatDate(iso: string | null, timeZone?: string): string | null {
  return iso ? dateFormat({ dateStyle: 'medium', timeZone }).format(new Date(iso)) : null
}

export function formatTime(date: Date, timeZone?: string): string {
  return dateFormat({ timeStyle: 'short', timeZone }).format(date)
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
  const options = { numeric: 'auto' } as const
  for (const [unit, size] of relativeUnits) {
    if (Math.abs(seconds) >= size) {
      const f = cached('relative', options, (locale) => new Intl.RelativeTimeFormat(locale, options))
      return f.format(Math.round(seconds / size), unit)
    }
  }
  return i18n.t('time.justNow')
}
