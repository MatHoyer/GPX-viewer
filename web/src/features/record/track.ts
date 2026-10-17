/** One GPS fix; t in epoch milliseconds, ele null when the device gives none. */
export type Fix = { lat: number; lon: number; ele: number | null; t: number }

/** A recording: one segment per stretch walked between pauses. */
export type Segments = Fix[][]

/** Fixes less precise than this are dropped; under trees phones report 10-30 m. */
export const MAX_ACCURACY_M = 50
/** While standing still a fix is kept only this often, so the clock keeps moving. */
const STILL_KEEP_MS = 30_000
const MIN_MOVE_M = 3
/** Climbs smaller than this are GPS noise, not ascent. */
const ELE_HYSTERESIS_M = 5

export function distanceM(a: Pick<Fix, 'lat' | 'lon'>, b: Pick<Fix, 'lat' | 'lon'>): number {
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r
  const dLon = (b.lon - a.lon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h))
}

/** Whether a new fix is worth keeping after `last`. */
export function keepFix(last: Fix | undefined, fix: Fix, accuracyM: number): boolean {
  if (accuracyM > MAX_ACCURACY_M) return false
  if (!last) return true
  if (fix.t <= last.t) return false
  return distanceM(last, fix) >= MIN_MOVE_M || fix.t - last.t >= STILL_KEEP_MS
}

export type Totals = { distanceM: number; gainM: number; durationS: number }

export function totals(segments: Segments): Totals {
  let dist = 0
  let gain = 0
  let ms = 0
  for (const seg of segments) {
    let base: number | null = null
    for (let i = 0; i < seg.length; i++) {
      if (i > 0) dist += distanceM(seg[i - 1], seg[i])
      const ele = seg[i].ele
      if (ele === null) continue
      if (base === null || ele < base) base = ele
      else if (ele - base >= ELE_HYSTERESIS_M) {
        gain += ele - base
        base = ele
      }
    }
    if (seg.length > 1) ms += seg[seg.length - 1].t - seg[0].t
  }
  return { distanceM: dist, gainM: gain, durationS: ms / 1000 }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export function toGpx(segments: Segments, name: string): string {
  const segs = segments
    .filter((s) => s.length > 0)
    .map(
      (s) =>
        '<trkseg>' +
        s
          .map(
            (f) =>
              `<trkpt lat="${f.lat.toFixed(7)}" lon="${f.lon.toFixed(7)}">` +
              (f.ele === null ? '' : `<ele>${f.ele.toFixed(1)}</ele>`) +
              `<time>${new Date(f.t).toISOString()}</time></trkpt>`,
          )
          .join('') +
        '</trkseg>',
    )
    .join('')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" creator="GPX Viewer" xmlns="http://www.topografix.com/GPX/1/1">' +
    `<trk><name>${escapeXml(name)}</name>${segs}</trk></gpx>\n`
  )
}
