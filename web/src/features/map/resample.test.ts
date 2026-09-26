import { describe, expect, it } from 'vitest'

import { resamplePoints } from './resample'

// About 111 m per 0.001° of latitude.
describe('resamplePoints', () => {
  it('spaces points evenly across vertices', () => {
    const line: [number, number][] = [
      [6, 45],
      [6, 45.0003],
      [6, 45.001],
    ]
    const pts = resamplePoints([line], 25)
    expect(pts[0]).toEqual([6, 45])
    // 111 m of line gives a point every 25 m: 0, 25, 50, 75, 100.
    expect(pts).toHaveLength(5)
    const gaps = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) * 111_195)
    for (const g of gaps) expect(g).toBeCloseTo(25, 0)
  })

  it('keeps short lines as their first point', () => {
    expect(
      resamplePoints(
        [
          [
            [6, 45],
            [6, 45.0001],
          ],
          [],
        ],
        25,
      ),
    ).toEqual([[6, 45]])
  })
})
