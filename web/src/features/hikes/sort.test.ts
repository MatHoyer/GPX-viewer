import { describe, expect, it } from 'vitest'

import type { Hike } from './api'
import { sortHikes } from './sort'

const hike = (name: string, startedAt: string | null, distanceM: number, durationS = 0) =>
  ({ id: name, name, startedAt, distanceM, elevationGainM: 0, durationS }) as Hike

const hikes = [
  hike('b', '2026-05-01T08:00:00Z', 5000, 3600),
  hike('undated', null, 1000),
  hike('A10', '2026-07-01T08:00:00Z', 12000),
  hike('a2', '2026-06-01T08:00:00Z', 8000, 7200),
]
const names = (hs: Hike[]) => hs.map((h) => h.name)

describe('sortHikes', () => {
  it('sorts by date, newest first, undated last', () => {
    expect(names(sortHikes(hikes, { key: 'date', desc: true }))).toEqual(['A10', 'a2', 'b', 'undated'])
    expect(names(sortHikes(hikes, { key: 'date', desc: false }))).toEqual(['b', 'a2', 'A10', 'undated'])
  })

  it('sorts names naturally, ignoring case', () => {
    expect(names(sortHikes(hikes, { key: 'name', desc: false }))).toEqual(['a2', 'A10', 'b', 'undated'])
  })

  it('keeps hikes without a duration last', () => {
    expect(names(sortHikes(hikes, { key: 'duration', desc: true }))).toEqual(['a2', 'b', 'undated', 'A10'])
  })

  it('does not change the input', () => {
    sortHikes(hikes, { key: 'distance', desc: true })
    expect(names(hikes)).toEqual(['b', 'undated', 'A10', 'a2'])
  })
})
