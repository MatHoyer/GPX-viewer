import { describe, expect, it } from 'vitest'

import {
  boundsBetween,
  fillMonotonic,
  indexAt,
  linesBetween,
  paceMinPerKm,
  positionAt,
  valueAt,
  xAt,
  xValues,
  type Profile,
} from './profile'

const profile: Profile = {
  has: { time: true, ele: true, hr: false, cad: false, temp: false },
  summary: {} as Profile['summary'],
  lon: [0, 1, 2, 10, 11],
  lat: [0, 0, 0, 5, 5],
  dist: [0, 100, 200, 200, 300],
  seg: [0, 0, 0, 1, 1],
  ele: [10, 20, null, 40, 50],
  t: [0, 60, 120, 600, null],
}

describe('axis helpers', () => {
  it('fills gaps in time series', () => {
    expect(fillMonotonic([0, null, 30, 20, 40])).toEqual([0, 0, 30, 30, 40])
  })

  it('picks x values by axis', () => {
    expect(xValues(profile, 'dist')).toBe(profile.dist)
    expect(xValues(profile, 'time')).toEqual([0, 60, 120, 600, 600])
    expect(xValues({ ...profile, has: { ...profile.has, time: false } }, 'time')).toBe(profile.dist)
  })

  it('finds fractional indices', () => {
    const xs = profile.dist
    expect(indexAt(xs, -5)).toBe(0)
    expect(indexAt(xs, 50)).toBe(0.5)
    expect(indexAt(xs, 150)).toBe(1.5)
    expect(indexAt(xs, 200)).toBe(2) // first index of a flat run
    expect(indexAt(xs, 250)).toBe(3.5)
    expect(indexAt(xs, 999)).toBe(4)
  })

  it('maps fractional indices back to x', () => {
    expect(xAt(profile.dist, 1.5)).toBe(150)
    expect(xAt(profile.dist, 4)).toBe(300)
    expect(xAt(profile.dist, indexAt(profile.dist, 275))).toBe(275)
  })
})

describe('values and positions', () => {
  it('interpolates values and tolerates nulls', () => {
    expect(valueAt(profile.ele, 0.5)).toBe(15)
    expect(valueAt(profile.ele, 1.5)).toBe(20)
    expect(valueAt(profile.ele, 4)).toBe(50)
    expect(valueAt(undefined, 1)).toBeNull()
  })

  it('does not interpolate position across segments', () => {
    expect(positionAt(profile, 0.5)).toEqual([0.5, 0])
    expect(positionAt(profile, 2.5)).toEqual([2, 0])
  })

  it('splits lines at segment gaps', () => {
    expect(linesBetween(profile, 0, 4)).toEqual([
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [10, 5],
        [11, 5],
      ],
    ])
    expect(linesBetween(profile, 0.5, 1.5)).toEqual([
      [
        [0.5, 0],
        [1, 0],
        [1.5, 0],
      ],
    ])
    expect(linesBetween(profile, 1, 1)).toEqual([])
  })

  it('computes bounds of a range', () => {
    expect(boundsBetween(profile)).toEqual([0, 0, 11, 5])
    expect(boundsBetween(profile, 0, 2)).toEqual([0, 0, 2, 0])
  })

  it('converts speed to pace', () => {
    expect(paceMinPerKm(1000 / 600)).toBeCloseTo(10)
    expect(paceMinPerKm(0.1)).toBeNull()
  })
})
