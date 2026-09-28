import { describe, expect, it } from 'vitest'

import { estimatedDurationS } from './estimate'

describe('estimatedDurationS', () => {
  it('walks 3.5 km in an hour', () => {
    expect(estimatedDurationS(3500)).toBeCloseTo(3600)
  })

  it('is zero for an empty route', () => {
    expect(estimatedDurationS(0)).toBe(0)
  })
})
