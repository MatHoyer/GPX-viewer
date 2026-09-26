/** Explored tiles of each hike, as returned by the API. */
export type HikeTiles = { zoom: number; hikes: Record<string, [x: number, y: number][]> }

export type Square = { x: number; y: number; size: number }

const key = (x: number, y: number) => `${x},${y}`

/** Distinct tiles covered by the given hikes, as "x,y" keys. */
export function exploredTiles(tiles: HikeTiles | undefined, hikeIds: Iterable<string>): Set<string> {
  const out = new Set<string>()
  if (!tiles) return out
  for (const id of hikeIds) for (const [x, y] of tiles.hikes[id] ?? []) out.add(key(x, y))
  return out
}

/**
 * The largest square block of explored tiles, by its top-left tile.
 * Classic dynamic programming: each tile's square is one more than the
 * smallest square ending at its left, top and top-left neighbours.
 */
export function maxSquare(explored: Set<string>): Square | null {
  const tiles = [...explored].map((k) => k.split(',').map(Number) as [number, number])
  tiles.sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const size = new Map<string, number>()
  let best: Square | null = null
  for (const [x, y] of tiles) {
    const s = 1 + Math.min(size.get(key(x - 1, y)) ?? 0, size.get(key(x, y - 1)) ?? 0, size.get(key(x - 1, y - 1)) ?? 0)
    size.set(key(x, y), s)
    if (!best || s > best.size) best = { x: x - s + 1, y: y - s + 1, size: s }
  }
  return best
}

function lon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180
}

function lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z
  return (180 / Math.PI) * Math.atan(Math.sinh(n))
}

/** Closed ring of a block of `size`×`size` tiles whose top-left tile is (x, y). */
export function tileRing(x: number, y: number, z: number, size = 1): [number, number][] {
  const w = lon(x, z)
  const e = lon(x + size, z)
  const n = lat(y, z)
  const s = lat(y + size, z)
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
    [w, n],
  ]
}
