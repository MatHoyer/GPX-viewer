const EARTH_RADIUS_M = 6371008.8
const RAD = Math.PI / 180

function distanceM([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const dLat = (lat2 - lat1) * RAD
  const dLon = (lon2 - lon1) * RAD
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Points every `spacingM` meters along each line, starting at its first vertex. */
export function resamplePoints(lines: [number, number][][], spacingM: number): [number, number][] {
  const out: [number, number][] = []
  for (const line of lines) {
    if (line.length === 0) continue
    out.push(line[0])
    // Distance still to travel before the next point.
    let next = spacingM
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]
      const b = line[i]
      const len = distanceM(a, b)
      let along = 0
      while (len - along >= next) {
        along += next
        const t = along / len
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        next = spacingM
      }
      next -= len - along
    }
  }
  return out
}
