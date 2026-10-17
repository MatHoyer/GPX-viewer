import { describe, expect, it } from 'vitest'

import { distanceM, keepFix, toGpx, totals, type Fix } from './track'

const fix = (lat: number, lon: number, t: number, ele: number | null = null): Fix => ({ lat, lon, ele, t })

describe('distanceM', () => {
  it('measures a degree of latitude', () => {
    expect(distanceM(fix(45, 6, 0), fix(46, 6, 0))).toBeCloseTo(111_195, -2)
  })
})

describe('keepFix', () => {
  const last = fix(45, 6, 0)
  it('keeps the first precise fix', () => expect(keepFix(undefined, last, 10)).toBe(true))
  it('drops imprecise fixes', () => expect(keepFix(undefined, last, 80)).toBe(false))
  it('drops jitter while standing still', () => expect(keepFix(last, fix(45.00001, 6, 5_000), 10)).toBe(false))
  it('keeps a still fix now and then', () => expect(keepFix(last, fix(45.00001, 6, 30_000), 10)).toBe(true))
  it('keeps a move', () => expect(keepFix(last, fix(45.0001, 6, 5_000), 10)).toBe(true))
  it('drops fixes out of order', () => expect(keepFix(last, fix(45.001, 6, 0), 10)).toBe(false))
})

describe('totals', () => {
  it('adds segments, skipping the pause between them', () => {
    const t = totals([
      [fix(45, 6, 0, 1000), fix(45.001, 6, 60_000, 1003), fix(45.002, 6, 120_000, 1010)],
      [fix(45.01, 6, 600_000, 1010), fix(45.011, 6, 660_000, 1004)],
    ])
    expect(t.durationS).toBe(180)
    expect(t.distanceM).toBeCloseTo(3 * 111.2, 0)
    // 1000 → 1010 counts once; the 3 m step alone is noise.
    expect(t.gainM).toBe(10)
  })
})

describe('toGpx', () => {
  it('writes one trkseg per segment and escapes the name', () => {
    const gpx = toGpx([[fix(45, 6, 0, 1000)], [fix(45.1, 6.1, 1000)], []], 'A & B')
    expect(gpx.match(/<trkseg>/g)).toHaveLength(2)
    expect(gpx).toContain('<name>A &#38; B</name>')
    expect(gpx).toContain('<trkpt lat="45.0000000" lon="6.0000000"><ele>1000.0</ele><time>1970-01-01T00:00:00.000Z</time></trkpt>')
  })
})
