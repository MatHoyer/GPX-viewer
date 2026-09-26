import type { Bounds } from '@/features/hikes/api'

export type Series = (number | null)[]

export type ProfileSummary = {
  distanceM: number
  elevationGainM: number
  elevationLossM: number
  minEle: number | null
  maxEle: number | null
  elapsedS: number | null
  movingS: number | null
  avgSpeedMS: number | null
  maxSpeedMS: number | null
  avgHR: number | null
  maxHR: number | null
  avgCad: number | null
  avgTemp: number | null
}

export type Profile = {
  has: { time: boolean; ele: boolean; hr: boolean; cad: boolean; temp: boolean }
  summary: ProfileSummary
  lon: number[]
  lat: number[]
  dist: number[]
  seg: number[]
  ele?: Series
  t?: Series
  speed?: Series
  hr?: Series
  cad?: Series
  temp?: Series
}

export type Axis = 'dist' | 'time'
export type LngLat = [number, number]

/** Fills gaps in a mostly complete, increasing series so it can be used as an axis. */
export function fillMonotonic(series: Series): number[] {
  const out = new Array<number>(series.length)
  let last = 0
  for (let i = 0; i < series.length; i++) {
    const v = series[i]
    last = v !== null && v >= last ? v : last
    out[i] = last
  }
  return out
}

/** X values for the chosen axis; falls back to distance when there is no time. */
export function xValues(p: Profile, axis: Axis): number[] {
  return axis === 'time' && p.has.time && p.t ? fillMonotonic(p.t) : p.dist
}

/**
 * Fractional index at which the non-decreasing `xs` reaches `x`.
 * On flat runs (e.g. a pause on the distance axis) the first index wins.
 */
export function indexAt(xs: number[], x: number): number {
  const n = xs.length
  if (n === 0) return 0
  if (x <= xs[0]) return 0
  if (x >= xs[n - 1]) return n - 1
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] < x) lo = mid
    else hi = mid
  }
  const span = xs[hi] - xs[lo]
  return span > 0 ? lo + (x - xs[lo]) / span : lo
}

/** X value at a fractional index. */
export function xAt(xs: number[], f: number): number {
  const i = Math.floor(f)
  if (i >= xs.length - 1) return xs[xs.length - 1] ?? 0
  if (i < 0) return xs[0] ?? 0
  return xs[i] + (xs[i + 1] - xs[i]) * (f - i)
}

/** Linearly interpolated value at a fractional index, or null when data is missing. */
export function valueAt(series: Series | undefined, f: number): number | null {
  if (!series || series.length === 0) return null
  const i = Math.max(0, Math.min(series.length - 1, Math.floor(f)))
  const a = series[i]
  if (i === series.length - 1 || f === i) return a
  const b = series[i + 1]
  if (a === null || b === null) return a ?? b
  return a + (b - a) * (f - i)
}

export function positionAt(p: Profile, f: number): LngLat {
  const i = Math.max(0, Math.min(p.lon.length - 1, Math.floor(f)))
  const j = Math.min(p.lon.length - 1, i + 1)
  const r = p.seg[i] === p.seg[j] ? f - i : 0
  return [p.lon[i] + (p.lon[j] - p.lon[i]) * r, p.lat[i] + (p.lat[j] - p.lat[i]) * r]
}

/** Coordinates between two fractional indices, split into lines at segment gaps. */
export function linesBetween(p: Profile, from: number, to: number): LngLat[][] {
  const n = p.lon.length
  if (n === 0 || to <= from) return []
  const start = Math.max(0, from)
  const end = Math.min(n - 1, to)
  const lines: LngLat[][] = []
  let current: LngLat[] = [positionAt(p, start)]
  let currentSeg = p.seg[Math.floor(start)]
  for (let i = Math.floor(start) + 1; i <= Math.floor(end); i++) {
    if (p.seg[i] !== currentSeg) {
      if (current.length > 1) lines.push(current)
      current = []
      currentSeg = p.seg[i]
    }
    current.push([p.lon[i], p.lat[i]])
  }
  if (end > Math.floor(end)) current.push(positionAt(p, end))
  if (current.length > 1) lines.push(current)
  return lines
}

export function boundsBetween(p: Profile, from = 0, to = p.lon.length - 1): Bounds | null {
  const lines = linesBetween(p, from, to)
  if (lines.length === 0) return null
  const b: Bounds = [Infinity, Infinity, -Infinity, -Infinity]
  for (const line of lines) {
    for (const [lon, lat] of line) {
      b[0] = Math.min(b[0], lon)
      b[1] = Math.min(b[1], lat)
      b[2] = Math.max(b[2], lon)
      b[3] = Math.max(b[3], lat)
    }
  }
  return b
}

/** Converts m/s to minutes per km; very slow values are dropped as they are not meaningful pace. */
export function paceMinPerKm(speedMS: number | null): number | null {
  if (speedMS === null || speedMS < 0.28) return null // slower than ~1 km/h
  return 1000 / speedMS / 60
}

export function speedKmh(speedMS: number | null): number | null {
  return speedMS === null ? null : speedMS * 3.6
}
