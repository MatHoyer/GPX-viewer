import { describe, expect, it } from 'vitest'

import type { Hike } from '@/features/hikes/api'

import { change, hikeYears, longestWeekStreak, monthlyTotals, totals, yearlyTotals } from './stats'

function hike(startedAt: string | null, over: Partial<Hike> = {}): Hike {
  return {
    id: startedAt ?? 'x',
    userId: 'me',
    name: 'Hike',
    distanceM: 10000,
    elevationGainM: 500,
    startedAt,
    durationS: 7200,
    notes: '',
    labels: [],
    elevationLossM: 500,
    minEleM: null,
    maxEleM: null,
    movingS: 6000,
    bestEfforts: [],
    bounds: [0, 0, 1, 1],
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

// Local noon so the day and month do not depend on the test machine's time zone.
const at = (date: string) => new Date(`${date}T12:00:00`).toISOString()

describe('totals', () => {
  it('sums hikes, preferring moving time and counting distinct days', () => {
    const t = totals([hike(at('2026-07-01')), hike(at('2026-07-01'), { movingS: null }), hike(null)])
    expect(t).toEqual({ count: 3, distanceM: 30000, gainM: 1500, timeS: 6000 + 7200 + 6000, days: 1 })
  })
})

describe('by period', () => {
  const hikes = [hike(at('2024-03-10')), hike(at('2026-01-05')), hike(at('2026-01-20')), hike(at('2026-12-31')), hike(null)]

  it('lists years with hikes, newest first', () => {
    expect(hikeYears(hikes)).toEqual([2026, 2024])
  })

  it('totals each month of a year', () => {
    const months = monthlyTotals(hikes, 2026)
    expect(months).toHaveLength(12)
    expect(months.map((m) => m.count)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
  })

  it('totals every year in range, including empty ones', () => {
    expect(yearlyTotals(hikes).map((y) => [y.year, y.totals.count])).toEqual([
      [2024, 1],
      [2025, 0],
      [2026, 3],
    ])
  })
})

describe('longestWeekStreak', () => {
  it('counts consecutive Monday-to-Sunday weeks', () => {
    // Mon 06-29 to Sun 07-05 is one week and 07-06 the next; nothing in the week of 07-13.
    const days = ['2026-06-29', '2026-07-05', '2026-07-06', '2026-07-12', '2026-07-20', '2026-07-27']
    expect(longestWeekStreak(days.map((d) => hike(at(d))))).toBe(2)
    expect(longestWeekStreak([...days, '2026-07-14'].map((d) => hike(at(d))))).toBe(5)
    expect(longestWeekStreak([])).toBe(0)
  })
})

describe('change', () => {
  it('is relative to the previous value', () => {
    expect(change(150, 100)).toBeCloseTo(0.5)
    expect(change(5, 0)).toBeNull()
  })
})
