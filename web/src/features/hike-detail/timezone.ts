import tzLookup from '@photostructure/tz-lookup'

/**
 * The IANA time zone at [lon, lat], so a hike's times read as they did on the
 * trail rather than in the viewer's zone; undefined (the viewer's zone) when
 * there is no start point or the lookup fails.
 */
export function timeZoneAt(start: [number, number] | undefined): string | undefined {
  if (!start) return undefined
  try {
    return tzLookup(start[1], start[0])
  } catch {
    return undefined
  }
}
