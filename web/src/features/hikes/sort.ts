import type { Hike } from './api'

export type SortKey = 'name' | 'date' | 'distance' | 'elevation' | 'duration'
export type Sort = { key: SortKey; desc: boolean }

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

const value: Record<Exclude<SortKey, 'name'>, (h: Hike) => number | null> = {
  date: (h) => (h.startedAt ? Date.parse(h.startedAt) : null),
  distance: (h) => h.distanceM,
  elevation: (h) => h.elevationGainM,
  duration: (h) => (h.durationS > 0 ? h.durationS : null),
}

/** A sorted copy of hikes. Missing dates and durations go last either way. */
export function sortHikes(hikes: Hike[], { key, desc }: Sort): Hike[] {
  const dir = desc ? -1 : 1
  return hikes.toSorted((a, b) => {
    if (key === 'name') return dir * collator.compare(a.name, b.name)
    const x = value[key](a)
    const y = value[key](b)
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    return dir * (x - y)
  })
}
