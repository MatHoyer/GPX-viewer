import { describe, expect, it } from 'vitest'

import type { Hike } from '@/features/hikes/api'

import { personalRecords } from './records'

function hike(id: string, over: Partial<Hike> = {}): Hike {
  return {
    id,
    userId: 'me',
    name: id,
    distanceM: 10000,
    elevationGainM: 500,
    startedAt: null,
    durationS: 7200,
    notes: '',
    labels: [],
    elevationLossM: 500,
    minEleM: null,
    maxEleM: null,
    movingS: null,
    bestEfforts: [],
    bounds: [0, 0, 1, 1],
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

// Newest first, like the API.
const hikes = [
  hike('newest', { distanceM: 15000, maxEleM: 2100, bestEfforts: [{ distanceM: 1000, durationS: 540 }] }),
  hike('middle', { elevationGainM: 1200, bestEfforts: [{ distanceM: 1000, durationS: 480 }, { distanceM: 5000, durationS: 3000 }] }),
  hike('oldest', { distanceM: 15000, durationS: 30000 }),
]

describe('personalRecords', () => {
  const byKey = Object.fromEntries(personalRecords(hikes).map((r) => [r.key, r]))

  it('picks the best hike for each record, keeping the first on ties', () => {
    expect(byKey.distance.hike.id).toBe('oldest')
    expect(byKey.gain.hike.id).toBe('middle')
    expect(byKey.highest.hike.id).toBe('newest')
    expect(byKey.duration.hike.id).toBe('oldest')
  })

  it('takes the fastest effort for each distance any hike covers', () => {
    expect(byKey['effort-1000']).toMatchObject({ label: 'Fastest 1 km', value: '8 min', detail: '8:00 /km' })
    expect(byKey['effort-1000'].hike.id).toBe('middle')
    expect(byKey['effort-5000']).toMatchObject({ label: 'Fastest 5 km', detail: '10:00 /km' })
    expect(byKey['effort-10000']).toBeUndefined()
  })

  it('leaves out records no hike has', () => {
    expect(personalRecords([hike('a', { maxEleM: null })]).map((r) => r.key)).not.toContain('highest')
    expect(personalRecords([])).toEqual([])
  })
})
