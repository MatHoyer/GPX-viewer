import { describe, expect, it } from 'vitest'

import { firstVisit, summitsOn, type Summit } from './summits'

const peak = (id: number) => ({ id, name: `P${id}`, eleM: 2000, lon: 6.8, lat: 45.9 })
const summits: Summit[] = [
  { peak: peak(1), visits: [{ hikeId: 'c', startedAt: '2026-07-01T08:00:00Z' }, { hikeId: 'a', startedAt: '2025-06-01T08:00:00Z' }, { hikeId: 'x', startedAt: null }] },
  { peak: peak(2), visits: [{ hikeId: 'b', startedAt: null }] },
]

describe('summitsOn', () => {
  it('keeps summits and visits of the given hikes only', () => {
    const got = summitsOn(summits, new Set(['a', 'c']))
    expect(got.map((s) => s.peak.id)).toEqual([1])
    expect(got[0].visits.map((v) => v.hikeId)).toEqual(['c', 'a'])
  })
})

describe('firstVisit', () => {
  it('is the earliest dated visit', () => {
    expect(firstVisit(summits[0]).hikeId).toBe('a')
    expect(firstVisit(summits[1]).hikeId).toBe('b')
  })
})
