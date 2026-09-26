import { useMemo } from 'react'

import type { Hike } from './api'

// Distinct, saturated colors that read well on both light and dark basemaps.
const palette = ['#e4572e', '#2e86ab', '#8cb369', '#f4a259', '#9c6ade', '#17bebb', '#d1495b', '#3d5a80']

export function hikeColor(index: number): string {
  return palette[index % palette.length]
}

/** Each hike's color by id, from its position in `colorFrom` (default `hikes`) so filtering keeps colors stable. */
export function useHikeColors(hikes: Hike[], colorFrom?: Hike[]): Map<string, string> {
  return useMemo(() => new Map((colorFrom ?? hikes).map((h, i) => [h.id, hikeColor(i)])), [colorFrom, hikes])
}
