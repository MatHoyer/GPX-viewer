import { describe, expect, it } from 'vitest'

import { fitColumns } from './columnFit'

const shown = (width: number) =>
  Object.entries(fitColumns(width))
    .filter(([, v]) => v)
    .map(([k]) => k)

describe('fitColumns', () => {
  it('keeps only the name on a phone', () => {
    expect(shown(390)).toEqual([])
  })

  it('adds columns in order as room allows', () => {
    // 96 fixed + 240 name + 132 date + 104 distance = 572
    expect(shown(572)).toEqual(['date', 'distance'])
    expect(shown(571)).toEqual(['date'])
  })

  it('shows everything on a wide screen', () => {
    expect(shown(1100)).toEqual(['date', 'distance', 'elevation', 'duration', 'labels'])
  })
})
