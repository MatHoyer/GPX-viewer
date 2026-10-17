import { describe, expect, it } from 'vitest'

import type { Profile } from '@/features/hike-detail/profile'

import { distanceM } from './track'
import { gainAfter, progressOnRoute } from './route'

// Out and back along a meridian: 0 → 3 km north → back to the start, a point per 100 m.
function outAndBack(): Profile {
  const lat: number[] = []
  for (let i = 0; i <= 30; i++) lat.push(45 + i * 0.0009)
  for (let i = 29; i >= 0; i--) lat.push(45 + i * 0.0009)
  const lon = lat.map(() => 6)
  const dist = [0]
  for (let i = 1; i < lat.length; i++) dist.push(dist[i - 1] + distanceM({ lat: lat[i - 1], lon: 6 }, { lat: lat[i], lon: 6 }))
  return { lat, lon, dist, seg: lat.map(() => 0), ele: lat.map((_, i) => (i <= 30 ? 1000 + i * 10 : 1300 - (i - 30) * 10)) } as Profile
}

describe('progressOnRoute', () => {
  const p = outAndBack()

  it('starts on the way out', () => {
    expect(progressOnRoute(p, 45.0009, 6, null).index).toBe(1)
  })

  it('stays on the way back past the same spot', () => {
    // Index 59 is back near the start, where the way out (index 1) is as close.
    expect(progressOnRoute(p, 45.0009, 6, 58).index).toBe(59)
  })

  it('finds the route again after getting lost', () => {
    const r = progressOnRoute(p, 45.018, 6.01, 2)
    expect(r.index).toBe(20)
    expect(r.offM).toBeGreaterThan(700)
  })
})

describe('gainAfter', () => {
  it('sums only the climbs ahead', () => {
    const p = outAndBack()
    expect(gainAfter(p, 0)).toBeCloseTo(300)
    expect(gainAfter(p, 20)).toBeCloseTo(100)
    expect(gainAfter(p, 30)).toBe(0)
  })
})
