import { describe, expect, it } from 'vitest'

import type { Profile } from './profile'
import { daylightAt, lightBands, plannedFinish, sunAtIndex, sunTint } from './sun'

// On the equator at the March equinox the sun sets around 18:07 UTC and civil dusk ends around 18:28.
const EQUINOX = '2026-03-20T17:00:00Z'

function profile(t: (number | null)[], lat = 0): Profile {
  return {
    has: { time: true, ele: false, hr: false, cad: false, temp: false },
    summary: {} as Profile['summary'],
    lon: t.map(() => 0),
    lat: t.map(() => lat),
    dist: t.map((_, i) => i * 100),
    seg: t.map(() => 0),
    t,
  }
}

describe('lightBands', () => {
  it('splits a hike walked into the night', () => {
    // 17:00, 17:30, 18:15, 19:00, 19:30
    const p = profile([0, 1800, 4500, 7200, 9000])
    expect(lightBands(p, EQUINOX)).toEqual([
      { from: 1.5, to: 2.5, light: 'twilight', rising: false },
      { from: 2.5, to: 4, light: 'night', rising: false },
    ])
  })

  it('keeps the previous light across missing times', () => {
    const p = profile([0, 7200, null, 9000])
    expect(lightBands(p, EQUINOX)).toEqual([{ from: 0.5, to: 3, light: 'night', rising: false }])
  })

  it('has no bands in daylight, without times or without a start', () => {
    expect(lightBands(profile([0, 600, 1200]), EQUINOX)).toEqual([])
    expect(lightBands({ ...profile([0, 600]), has: { ...profile([]).has, time: false } }, EQUINOX)).toEqual([])
    expect(lightBands(profile([0, 600]), null)).toEqual([])
  })

  it('shades the whole hike during polar night', () => {
    const p = profile([0, 3600], 80)
    expect(lightBands(p, '2026-12-21T12:00:00Z')).toMatchObject([{ from: 0, to: 1, light: 'night' }])
  })

  it('tells dawn from dusk', () => {
    // 05:30 and 05:55 UTC: night, then civil twilight before the ~06:04 sunrise.
    const p = profile([0, 1500])
    expect(lightBands(p, '2026-03-20T05:30:00Z')).toEqual([
      { from: 0, to: 0.5, light: 'night', rising: true },
      { from: 0.5, to: 1, light: 'twilight', rising: true },
    ])
  })
})

describe('daylightAt', () => {
  it('gives sunrise and sunset of the start day', () => {
    const d = daylightAt(EQUINOX, 0, 0)
    expect(d.sunrise?.toISOString().slice(11, 13)).toBe('06')
    expect(d.sunset?.toISOString().slice(11, 13)).toBe('18')
  })

  it('flags polar day', () => {
    const d = daylightAt('2026-06-21T12:00:00Z', 80, 0)
    expect(d).toMatchObject({ sunrise: null, sunset: null, alwaysUp: true, alwaysDown: false })
  })
})

describe('sunAtIndex', () => {
  it('interpolates the time between points', () => {
    const p = profile([0, 7200])
    const noonish = sunAtIndex(p, '2026-03-20T11:00:00Z', 0.5)
    expect(noonish?.altitude).toBeGreaterThan(80)
    expect(sunAtIndex(p, null, 0)).toBeNull()
  })
})

describe('sunTint', () => {
  it('is clear by day and darkens into the night', () => {
    expect(sunTint(30).opacity).toBe(0)
    expect(sunTint(6)).toEqual({ color: 'rgb(255, 154, 60)', opacity: 0.06 })
    expect(sunTint(-4).opacity).toBeCloseTo(0.35)
    expect(sunTint(-40)).toEqual({ color: 'rgb(29, 35, 82)', opacity: 0.6 })
  })

  it('blends across the horizon without jumps', () => {
    const at = (alt: number) => sunTint(alt)
    expect(at(0)).toEqual({ color: 'rgb(142, 95, 71)', opacity: 0.185 })
    for (let alt = 12; alt > -14; alt -= 0.1) {
      expect(Math.abs(at(alt).opacity - at(alt - 0.1).opacity)).toBeLessThan(0.01)
    }
  })
})

describe('plannedFinish', () => {
  // Civil dusk on the equator at the equinox ends around 18:28 UTC.
  const start = new Date('2026-03-20T12:00:00Z')

  it('finishes before dusk', () => {
    const f = plannedFinish(start, 4 * 3600, 0, 0)
    expect(f.finish.toISOString()).toBe('2026-03-20T16:00:00.000Z')
    expect(f.afterDusk).toBe(false)
  })

  it('warns when finishing after dusk', () => {
    expect(plannedFinish(start, 7 * 3600, 0, 0).afterDusk).toBe(true)
  })

  it('handles polar day and night', () => {
    const summer = plannedFinish(new Date('2026-06-21T12:00:00Z'), 20 * 3600, 80, 0)
    expect(summer).toMatchObject({ alwaysUp: true, afterDusk: false })
    const winter = plannedFinish(new Date('2026-12-21T12:00:00Z'), 3600, 80, 0)
    expect(winter).toMatchObject({ alwaysDown: true, afterDusk: true })
  })
})
