import type { Bounds } from './api'

export function unionBounds(all: Bounds[]): Bounds | null {
  if (all.length === 0) return null
  return all.reduce<Bounds>(
    (acc, b) => [Math.min(acc[0], b[0]), Math.min(acc[1], b[1]), Math.max(acc[2], b[2]), Math.max(acc[3], b[3])],
    [...all[0]],
  )
}

/** Whether two [minLon, minLat, maxLon, maxLat] boxes overlap, edges included. */
export function intersects(a: Bounds, b: Bounds): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}
