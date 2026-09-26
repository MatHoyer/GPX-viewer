import { describe, expect, it } from 'vitest'

import { ascent, contours, featured, heightAt, sampleTrack } from './terrain'

describe('contours', () => {
  it('only leaves lines open where they run off the map', () => {
    const [w, h] = [1600, 1000]
    const onEdge = (x: number, y: number) => x < 1 || y < 1 || x > w - 1 || y > h - 1
    for (const c of contours(w, h, 110, 70, 24)) {
      for (const line of c.d.split('M').slice(1)) {
        const n = line.match(/-?[\d.]+/g)!.map(Number)
        const [x0, y0, x1, y1] = [n[0], n[1], n[n.length - 2], n[n.length - 1]]
        const closed = Math.hypot(x0 - x1, y0 - y1) < 0.5
        expect(closed || (onEdge(x0, y0) && onEdge(x1, y1))).toBe(true)
      }
    }
  })

  it('marks every fifth level as an index contour', () => {
    expect(contours(160, 100, 16, 10, 10).map((c) => c.index)).toEqual([
      false, false, false, false, true, false, false, false, false, true,
    ])
  })
})

describe('terrain', () => {
  it('keeps heights in 0..1 without flattening the summit', () => {
    let max = 0
    for (let j = 0; j <= 100; j++) for (let i = 0; i <= 100; i++) max = Math.max(max, heightAt(i / 100, j / 100))
    expect(max).toBeGreaterThan(0.95)
    expect(max).toBeLessThan(1)
  })

  it('gives the featured hike a real climb', () => {
    const samples = sampleTrack(featured)
    expect(ascent(samples)).toBeGreaterThan(1000)
    expect(samples.every((s, k) => k === 0 || s.km > samples[k - 1].km)).toBe(true)
  })
})
