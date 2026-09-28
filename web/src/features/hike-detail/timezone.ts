import { useQuery } from '@tanstack/react-query'

/** The zone boundaries weigh ~70 kB, so they load only on hike pages. */
const loadTzLookup = () => import('@photostructure/tz-lookup').then((m) => m.default)

/**
 * The IANA time zone at [lon, lat], so a hike's times read as they did on the
 * trail rather than in the viewer's zone; undefined (the viewer's zone) when
 * there is no start point or the lookup fails.
 */
export async function timeZoneAt(start: [number, number] | undefined): Promise<string | undefined> {
  if (!start) return undefined
  try {
    return (await loadTzLookup())(start[1], start[0])
  } catch {
    return undefined
  }
}

/** timeZoneAt as a hook; the viewer's zone until the lookup has loaded. */
export function useTimeZone(start: [number, number] | undefined): string | undefined {
  const { data } = useQuery({
    queryKey: ['timezone', start?.[0], start?.[1]],
    queryFn: async () => (await timeZoneAt(start)) ?? null,
    enabled: !!start,
    staleTime: Infinity,
  })
  return data ?? undefined
}

/** Local wall-clock parts of date in timeZone (the viewer's when undefined). */
function wallClock(date: Date, timeZone?: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]))
}

/** How far timeZone is ahead of UTC at date, in ms. */
function offsetMs(date: Date, timeZone?: string): number {
  const c = wallClock(date, timeZone)
  return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second) - Math.floor(date.getTime() / 1000) * 1000
}

/** A datetime-local input value ("2026-07-01T08:00") for date as read in timeZone. */
export function toLocalInput(date: Date, timeZone?: string): string {
  const c = wallClock(date, timeZone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${c.year}-${pad(c.month)}-${pad(c.day)}T${pad(c.hour)}:${pad(c.minute)}`
}

/** The instant a datetime-local input value names in timeZone; null when the value is empty or malformed. */
export function fromLocalInput(value: string, timeZone?: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  // Correct by the zone's offset, twice so a guess on the far side of a DST change settles.
  let t = asUtc - offsetMs(new Date(asUtc), timeZone)
  t = asUtc - offsetMs(new Date(t), timeZone)
  return new Date(t)
}
