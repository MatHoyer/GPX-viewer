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
