import { describe, expect, it } from 'vitest'

import type { Hike } from './api'
import { activeFilterCount, filterHikes, hikePeople, noFilters } from './filters'

const me = { id: 'me', name: 'Me' }
const ana = { id: 'ana', name: 'Ana' }
const bo = { id: 'bo', name: 'Bo' }

function hike(over: Partial<Hike>): Hike {
  return {
    id: over.name ?? 'h',
    userId: 'me',
    name: 'Hike',
    distanceM: 10000,
    elevationGainM: 500,
    startedAt: '2026-07-01T08:00:00Z',
    durationS: 3600,
    notes: '',
    labels: [],
    elevationLossM: 500,
    minEleM: null,
    maxEleM: null,
    movingS: null,
    bounds: [0, 0, 1, 1],
    createdAt: '2026-07-01T12:00:00Z',
    owner: me,
    participants: [],
    ...over,
  }
}

const hikes = [
  hike({ name: 'Lac Blanc', notes: 'Windy col', labels: ['alps', 'snow'], participants: [ana] }),
  hike({ name: 'Short loop', distanceM: 3000, elevationGainM: 80, startedAt: '2026-05-10T08:00:00Z' }),
  hike({ name: 'With Bo', userId: 'bo', owner: bo, participants: [me, ana], labels: ['alps'] }),
  hike({ name: 'Undated', startedAt: null }),
]
const names = (f: Partial<typeof noFilters>) => filterHikes(hikes, { ...noFilters, ...f }, 'me').map((h) => h.name)

describe('filterHikes', () => {
  it('returns everything without filters', () => {
    expect(filterHikes(hikes, noFilters, 'me')).toBe(hikes)
  })

  it('searches name, notes and labels ignoring case', () => {
    expect(names({ query: 'LAC' })).toEqual(['Lac Blanc'])
    expect(names({ query: 'windy' })).toEqual(['Lac Blanc'])
    expect(names({ query: 'snow' })).toEqual(['Lac Blanc'])
  })

  it('filters by inclusive date range and drops undated hikes', () => {
    expect(names({ from: '2026-07-01' })).toEqual(['Lac Blanc', 'With Bo'])
    expect(names({ to: '2026-05-10' })).toEqual(['Short loop'])
  })

  it('filters by distance and elevation gain', () => {
    expect(names({ maxKm: 5 })).toEqual(['Short loop'])
    expect(names({ minGainM: 100, maxKm: 10 })).toEqual(['Lac Blanc', 'With Bo', 'Undated'])
  })

  it('requires every selected label and person', () => {
    expect(names({ labels: ['alps'] })).toEqual(['Lac Blanc', 'With Bo'])
    expect(names({ labels: ['alps', 'snow'] })).toEqual(['Lac Blanc'])
    expect(names({ people: ['ana'] })).toEqual(['Lac Blanc', 'With Bo'])
    expect(names({ people: ['ana', 'bo'] })).toEqual(['With Bo'])
  })
})

describe('hikePeople', () => {
  it('lists the owner and participants other than the viewer', () => {
    expect(hikePeople(hikes[2], 'me')).toEqual([bo, ana])
    expect(hikePeople(hikes[0], 'me')).toEqual([ana])
  })
})

describe('activeFilterCount', () => {
  it('counts each range once', () => {
    expect(activeFilterCount({ ...noFilters, minKm: 1, maxKm: 5, query: ' ' })).toBe(1)
    expect(activeFilterCount({ ...noFilters, from: '2026-01-01', labels: ['a'] })).toBe(2)
  })
})
