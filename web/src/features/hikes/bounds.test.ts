import { describe, expect, it } from 'vitest'

import { intersects, unionBounds } from './bounds'

describe('intersects', () => {
  const view: [number, number, number, number] = [6, 45, 7, 46]
  it('matches overlapping, touching and contained boxes', () => {
    expect(intersects([6.5, 45.5, 8, 47], view)).toBe(true)
    expect(intersects([7, 46, 8, 47], view)).toBe(true)
    expect(intersects([6.2, 45.2, 6.3, 45.3], view)).toBe(true)
    expect(intersects([5, 44, 8, 47], view)).toBe(true)
  })
  it('rejects boxes off to any side', () => {
    expect(intersects([7.1, 45, 8, 46], view)).toBe(false)
    expect(intersects([6, 46.1, 7, 47], view)).toBe(false)
  })
})

describe('unionBounds', () => {
  it('covers every box, or is null for none', () => {
    expect(unionBounds([[6, 45, 7, 46], [5, 45.5, 6.5, 47]])).toEqual([5, 45, 7, 47])
    expect(unionBounds([])).toBeNull()
  })
})
