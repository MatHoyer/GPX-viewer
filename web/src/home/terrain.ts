// Synthetic terrain for the home page illustrations. Everything here runs once
// at build time (the page is prerendered), so it favors clarity over speed.

export type Pt = [number, number]

type Peak = { x: number; y: number; h: number; r: number }

// Positions are in 0..1 map space, x to the east, y to the south.
const peaks: Peak[] = [
  { x: 0.7, y: 0.34, h: 1, r: 0.16 },
  { x: 0.86, y: 0.68, h: 0.62, r: 0.13 },
  { x: 0.52, y: 0.62, h: 0.5, r: 0.17 },
  { x: 0.93, y: 0.18, h: 0.55, r: 0.12 },
  { x: 0.33, y: 0.3, h: 0.38, r: 0.15 },
  { x: 0.12, y: 0.78, h: 0.28, r: 0.2 },
]

function rawHeight(x: number, y: number): number {
  let h = 0.04
  for (const p of peaks) {
    const d2 = (x - p.x) ** 2 + (y - p.y) ** 2
    h += p.h * Math.exp(-d2 / (2 * p.r * p.r))
  }
  // A little ridge texture so contours don't look like perfect rings.
  h += 0.025 * Math.sin(x * 23 + y * 7) * Math.cos(y * 17 - x * 5)
  return h
}

// Overlapping peaks add up past 1; scale so the highest summit is just under it.
let highest = 0
for (let j = 0; j <= 200; j++) for (let i = 0; i <= 200; i++) highest = Math.max(highest, rawHeight(i / 200, j / 200))

/** Height in 0..1 at a point in map space. */
export function heightAt(x: number, y: number): number {
  return Math.min(1, Math.max(0, (rawHeight(x, y) / highest) * 0.98))
}

export type Contour = { d: string; index: boolean }

/**
 * Contour lines of `heightAt` over a width×height box, one path per level
 * (marching squares, segments chained into polylines). Every fifth level is an
 * index contour, drawn heavier like on a printed map.
 */
export function contours(width: number, height: number, cols: number, rows: number, levels: number): Contour[] {
  const grid: number[][] = []
  for (let j = 0; j <= rows; j++) {
    const row: number[] = []
    for (let i = 0; i <= cols; i++) row.push(heightAt(i / cols, j / rows))
    grid.push(row)
  }
  const sx = width / cols
  const sy = height / rows

  const out: Contour[] = []
  for (let l = 1; l <= levels; l++) {
    const level = l / (levels + 1)
    // Points live on cell edges; an edge id identifies a point exactly, which
    // is what lets segments from neighbouring cells be chained.
    const points = new Map<string, Pt>()
    const links = new Map<string, string[]>()
    const edgePoint = (id: string, a: Pt, b: Pt, ha: number, hb: number) => {
      if (!points.has(id)) {
        const t = (level - ha) / (hb - ha)
        points.set(id, [(a[0] + (b[0] - a[0]) * t) * sx, (a[1] + (b[1] - a[1]) * t) * sy])
      }
      return id
    }
    const link = (a: string, b: string) => {
      links.set(a, [...(links.get(a) ?? []), b])
      links.set(b, [...(links.get(b) ?? []), a])
    }

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const tl = grid[j][i]
        const tr = grid[j][i + 1]
        const br = grid[j + 1][i + 1]
        const bl = grid[j + 1][i]
        const code = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0)
        if (code === 0 || code === 15) continue
        const top = () => edgePoint(`h${i},${j}`, [i, j], [i + 1, j], tl, tr)
        const right = () => edgePoint(`v${i + 1},${j}`, [i + 1, j], [i + 1, j + 1], tr, br)
        const bottom = () => edgePoint(`h${i},${j + 1}`, [i, j + 1], [i + 1, j + 1], bl, br)
        const left = () => edgePoint(`v${i},${j}`, [i, j], [i, j + 1], tl, bl)
        switch (code) {
          case 1: case 14: link(left(), bottom()); break
          case 2: case 13: link(bottom(), right()); break
          case 3: case 12: link(left(), right()); break
          case 4: case 11: link(top(), right()); break
          case 6: case 9: link(top(), bottom()); break
          case 7: case 8: link(left(), top()); break
          case 5: link(left(), top()); link(bottom(), right()); break
          case 10: link(left(), bottom()); link(top(), right()); break
        }
      }
    }

    // Walk each chain from an open end first so lines aren't split midway.
    const seen = new Set<string>()
    const starts = [...links.keys()].sort((a, b) => links.get(a)!.length - links.get(b)!.length)
    const parts: string[] = []
    for (const start of starts) {
      if (seen.has(start)) continue
      const chain: Pt[] = []
      let last = start
      let cur: string | undefined = start
      while (cur) {
        seen.add(cur)
        chain.push(points.get(cur)!)
        last = cur
        cur = links.get(cur)!.find((n) => !seen.has(n))
      }
      // A loop ends next to where it started.
      if (chain.length > 2 && links.get(last)!.includes(start)) chain.push(points.get(start)!)
      if (chain.length > 1) parts.push(smoothPath(chain))
    }
    out.push({ d: parts.join(''), index: l % 5 === 0 })
  }
  return out
}

const f = (n: number) => Math.round(n * 10) / 10

/** Quadratic curves through midpoints, which rounds off the grid's facets. */
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 3) return `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}`
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let k = 1; k < pts.length - 1; k++) {
    const mx = (pts[k][0] + pts[k + 1][0]) / 2
    const my = (pts[k][1] + pts[k + 1][1]) / 2
    d += `Q${f(pts[k][0])} ${f(pts[k][1])} ${f(mx)} ${f(my)}`
  }
  const last = pts[pts.length - 1]
  return `${d}L${f(last[0])} ${f(last[1])}`
}

/** Catmull-Rom spline through control points, sampled evenly per segment. */
export function spline(ctrl: Pt[], perSegment = 24): Pt[] {
  const pts: Pt[] = []
  for (let k = 0; k < ctrl.length - 1; k++) {
    const p0 = ctrl[Math.max(0, k - 1)]
    const p1 = ctrl[k]
    const p2 = ctrl[k + 1]
    const p3 = ctrl[Math.min(ctrl.length - 1, k + 2)]
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment
      const t2 = t * t
      const t3 = t2 * t
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      pts.push([at(p0[0], p1[0], p2[0], p3[0]), at(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  pts.push(ctrl[ctrl.length - 1])
  return pts
}

// The map spans this many kilometres east to west, heights span these metres.
export const MAP_KM = 14
const MIN_ELE = 780
const MAX_ELE = 2960

export type Sample = { km: number; ele: number; hr: number; speed: number }

/** Distance, elevation and plausible heart rate and speed along a track in map space. */
export function sampleTrack(track: Pt[]): Sample[] {
  const raw: { km: number; ele: number }[] = []
  let km = 0
  track.forEach((p, k) => {
    if (k > 0) km += Math.hypot(p[0] - track[k - 1][0], p[1] - track[k - 1][1]) * MAP_KM
    raw.push({ km, ele: MIN_ELE + heightAt(p[0], p[1]) * (MAX_ELE - MIN_ELE) })
  })
  // Heart rate follows the grade with some lag; speed drops as it steepens.
  let hr = 105
  return raw.map((s, k) => {
    const prev = raw[Math.max(0, k - 1)]
    const dist = Math.max(0.001, s.km - prev.km) * 1000
    const grade = (s.ele - prev.ele) / dist
    hr += (Math.min(178, 112 + Math.max(0, grade) * 260 + Math.max(0, -grade) * 20) - hr) * 0.18
    const speed = Math.max(1.8, 5.2 - Math.abs(grade) * 9 + (grade < 0 ? 0.6 : 0))
    return { ...s, hr: Math.round(hr), speed }
  })
}

export function ascent(samples: Sample[]): number {
  let up = 0
  for (let k = 1; k < samples.length; k++) up += Math.max(0, samples[k].ele - samples[k - 1].ele)
  return up
}

// Hand-placed tracks, in map space. The first one is the featured hike: up
// from the valley, over the main summit and down the eastern ridge.
export const featured: Pt[] = spline([
  [0.4, 0.95], [0.46, 0.8], [0.55, 0.74], [0.6, 0.58], [0.64, 0.46], [0.7, 0.35], [0.77, 0.3], [0.84, 0.4], [0.92, 0.46], [1.02, 0.44],
])

export const others: Pt[][] = [
  spline([[-0.02, 0.62], [0.12, 0.6], [0.22, 0.5], [0.3, 0.34], [0.38, 0.24], [0.48, 0.2], [0.58, 0.08], [0.62, -0.03]]),
  spline([[0.44, 0.55], [0.52, 0.5], [0.58, 0.6], [0.53, 0.7], [0.45, 0.68], [0.44, 0.55]]),
  spline([[0.68, 1.03], [0.75, 0.86], [0.85, 0.78], [0.92, 0.66], [0.97, 0.56], [1.03, 0.52]]),
  spline([[0.8, -0.03], [0.86, 0.1], [0.93, 0.16], [0.98, 0.26], [1.03, 0.3]]),
]

/** Scales map-space points to a viewBox and returns an SVG path. */
export function toPath(pts: Pt[], width: number, height: number): string {
  return `M${pts.map((p) => `${f(p[0] * width)} ${f(p[1] * height)}`).join('L')}`
}
