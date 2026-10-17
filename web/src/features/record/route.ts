import type { Profile } from '@/features/hike-detail/profile'

import { distanceM } from './track'

/** How far behind and ahead of the last match a position is looked for along the route. */
const BACK_M = 200
const AHEAD_M = 2000
/** Further than this from the route, the whole route is searched again. */
const LOST_M = 150

export type RouteProgress = { index: number; offM: number }

function nearest(p: Profile, lat: number, lon: number, from: number, to: number): RouteProgress {
  let best = { index: from, offM: Infinity }
  for (let i = from; i <= to; i++) {
    const d = distanceM({ lat, lon }, { lat: p.lat[i], lon: p.lon[i] })
    if (d < best.offM) best = { index: i, offM: d }
  }
  return best
}

/**
 * Where a position is along a planned route. Searching near the last match
 * keeps an out-and-back or a loop from jumping to the leg that passes close by.
 */
export function progressOnRoute(p: Profile, lat: number, lon: number, last: number | null): RouteProgress {
  const n = p.lon.length
  if (n === 0) return { index: 0, offM: Infinity }
  if (last !== null) {
    const done = p.dist[last]
    let from = last
    while (from > 0 && p.dist[from - 1] >= done - BACK_M) from--
    let to = last
    while (to < n - 1 && p.dist[to + 1] <= done + AHEAD_M) to++
    const near = nearest(p, lat, lon, from, to)
    if (near.offM <= LOST_M) return near
  }
  return nearest(p, lat, lon, 0, n - 1)
}

/** Climb left on the route after index i. */
export function gainAfter(p: Profile, i: number): number {
  let gain = 0
  const ele = p.ele ?? []
  for (let j = i + 1; j < ele.length; j++) {
    const a = ele[j - 1]
    const b = ele[j]
    if (a !== null && b !== null && b > a) gain += b - a
  }
  return gain
}
