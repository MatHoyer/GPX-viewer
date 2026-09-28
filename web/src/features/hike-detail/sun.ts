import { getPosition, getTimes } from 'suncalc'

import { positionAt, valueAt, type Profile } from './profile'

/** Sun altitudes (degrees) below which it is twilight, then night (civil twilight). */
const SUNSET_ALT = -0.833
const CIVIL_DUSK_ALT = -6

export type Light = 'twilight' | 'night'

/**
 * A run of profile points, by fractional index, walked in twilight or at
 * night; rising tells dawn from dusk.
 */
export type LightBand = { from: number; to: number; light: Light; rising: boolean }

function lightOf(altitude: number): Light | null {
  if (altitude > SUNSET_ALT) return null
  return altitude > CIVIL_DUSK_ALT ? 'twilight' : 'night'
}

/** Whether the sun is climbing, judged over the next ten minutes. */
function isRising(date: Date, lat: number, lon: number, altitude: number): boolean {
  return getPosition(new Date(date.getTime() + 600_000), lat, lon).altitude > altitude
}

/**
 * Stretches of a timed hike walked outside daylight. The profile's times are
 * seconds since startedAt; each band ends halfway to the next point so bands
 * meet without gaps.
 */
export function lightBands(p: Profile, startedAt: string | null): LightBand[] {
  if (!startedAt || !p.has.time || !p.t) return []
  const t0 = new Date(startedAt).getTime()
  const bands: LightBand[] = []
  let prev: Light | null = null
  for (let i = 0; i < p.t.length; i++) {
    const t = p.t[i]
    const date = t === null ? null : new Date(t0 + t * 1000)
    const altitude = date && getPosition(date, p.lat[i], p.lon[i]).altitude
    // Points without a time keep the light of the previous one.
    const light: Light | null = altitude === null ? prev : lightOf(altitude)
    const last = bands.at(-1)
    if (light !== null && light === prev && last) {
      last.to = i
    } else {
      const edge = Math.max(0, i - 0.5)
      if (prev !== null && last) last.to = edge
      if (light !== null) {
        const rising = date !== null && altitude !== null && isRising(date, p.lat[i], p.lon[i], altitude)
        bands.push({ from: edge, to: i, light, rising })
      }
    }
    prev = light
  }
  return bands
}

export type DaylightTimes = { sunrise: Date | null; sunset: Date | null; alwaysUp: boolean; alwaysDown: boolean }

/** Sunrise and sunset at the start of a hike, on the day it started. */
export function daylightAt(startedAt: string, lat: number, lon: number): DaylightTimes {
  const times = getTimes(new Date(startedAt), lat, lon)
  return { sunrise: times.sunrise, sunset: times.sunset, alwaysUp: !!times.alwaysUp, alwaysDown: !!times.alwaysDown }
}

export type SunPosition = { azimuth: number; altitude: number; rising: boolean }

/** Where the sun stands, in degrees, at a fractional profile index; null without a time there. */
export function sunAtIndex(p: Profile, startedAt: string | null, f: number): SunPosition | null {
  if (!startedAt || !p.has.time) return null
  const t = valueAt(p.t, f)
  if (t === null) return null
  const [lon, lat] = positionAt(p, f)
  const date = new Date(new Date(startedAt).getTime() + t * 1000)
  const { azimuth, altitude } = getPosition(date, lat, lon)
  return { azimuth, altitude, rising: isRising(date, lat, lon, altitude) }
}

export type SunTint = { color: string; opacity: number }

/** Wash by sun altitude, from high to low; colors and opacity blend linearly between stops. */
const TINT_STOPS: { alt: number; rgb: [number, number, number]; opacity: number }[] = [
  { alt: 10, rgb: [255, 154, 60], opacity: 0 },
  { alt: 2, rgb: [255, 154, 60], opacity: 0.12 },
  { alt: -2, rgb: [29, 35, 82], opacity: 0.25 },
  { alt: CIVIL_DUSK_ALT, rgb: [29, 35, 82], opacity: 0.45 },
  { alt: -12, rgb: [29, 35, 82], opacity: 0.6 },
]

/** A wash over the map for the sun's altitude: warm near the horizon, then darker blue through twilight into night. */
export function sunTint(altitude: number): SunTint {
  const first = TINT_STOPS[0]
  const last = TINT_STOPS[TINT_STOPS.length - 1]
  const rgb = (c: number[]) => `rgb(${c.map(Math.round).join(', ')})`
  if (altitude >= first.alt) return { color: rgb(first.rgb), opacity: first.opacity }
  if (altitude <= last.alt) return { color: rgb(last.rgb), opacity: last.opacity }
  const i = TINT_STOPS.findIndex((s) => altitude > s.alt)
  const [hi, lo] = [TINT_STOPS[i - 1], TINT_STOPS[i]]
  const r = (hi.alt - altitude) / (hi.alt - lo.alt)
  return {
    color: rgb(hi.rgb.map((c, k) => c + (lo.rgb[k] - c) * r)),
    opacity: hi.opacity + (lo.opacity - hi.opacity) * r,
  }
}
