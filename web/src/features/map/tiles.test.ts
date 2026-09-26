import { describe, expect, it } from 'vitest'

import { exploredTiles, maxSquare, tileRing } from './tiles'

const set = (...tiles: [number, number][]) => new Set(tiles.map(([x, y]) => `${x},${y}`))

describe('exploredTiles', () => {
  it('unions the tiles of the given hikes only', () => {
    const tiles = { zoom: 14, hikes: { a: [[1, 1], [1, 2]] as [number, number][], b: [[1, 2], [5, 5]] as [number, number][], c: [[9, 9]] as [number, number][] } }
    expect(exploredTiles(tiles, ['a', 'b', 'missing'])).toEqual(set([1, 1], [1, 2], [5, 5]))
    expect(exploredTiles(undefined, ['a']).size).toBe(0)
  })
})

describe('maxSquare', () => {
  it('finds the largest full square', () => {
    // A 3×3 block with one extra tile, next to a separate 2×2 block.
    const block = [] as [number, number][]
    for (let x = 10; x < 13; x++) for (let y = 20; y < 23; y++) block.push([x, y])
    const explored = set(...block, [13, 20], [0, 0], [1, 0], [0, 1], [1, 1])
    expect(maxSquare(explored)).toEqual({ x: 10, y: 20, size: 3 })
  })

  it('needs every tile of the square', () => {
    const holed = set([0, 0], [1, 0], [0, 1])
    expect(maxSquare(holed)?.size).toBe(1)
    expect(maxSquare(new Set())).toBeNull()
  })
})

describe('tileRing', () => {
  it('covers the tile in lon/lat', () => {
    const [nw, ne, se] = tileRing(8192, 8192, 14)
    expect(nw).toEqual([0, 0])
    expect(ne[0]).toBeCloseTo(360 / 16384)
    expect(se[1]).toBeLessThan(0)
  })
})
