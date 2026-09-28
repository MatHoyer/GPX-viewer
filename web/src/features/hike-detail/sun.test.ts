import { describe, expect, it } from 'vitest'

import type { Profile } from './profile'
import { daylightAt, lightBands } from './sun'

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
      { from: 1.5, to: 2.5, light: 'twilight' },
      { from: 2.5, to: 4, light: 'night' },
    ])
  })

  it('keeps the previous light across missing times', () => {
    const p = profile([0, 7200, null, 9000])
    expect(lightBands(p, EQUINOX)).toEqual([{ from: 0.5, to: 3, light: 'night' }])
  })

  it('has no bands in daylight, without times or without a start', () => {
    expect(lightBands(profile([0, 600, 1200]), EQUINOX)).toEqual([])
    expect(lightBands({ ...profile([0, 600]), has: { ...profile([]).has, time: false } }, EQUINOX)).toEqual([])
    expect(lightBands(profile([0, 600]), null)).toEqual([])
  })

  it('shades the whole hike during polar night', () => {
    const p = profile([0, 3600], 80)
    expect(lightBands(p, '2026-12-21T12:00:00Z')).toEqual([{ from: 0, to: 1, light: 'night' }])
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
