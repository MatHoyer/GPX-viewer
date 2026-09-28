import { describe, expect, it } from 'vitest'

import { formatRelative } from './format'

describe('formatRelative', () => {
  const now = Date.parse('2026-09-28T12:00:00Z')

  it('says just now under a minute', () => {
    expect(formatRelative('2026-09-28T11:59:30Z', now)).toBe('just now')
  })

  it('picks the largest whole unit', () => {
    expect(formatRelative('2026-09-28T11:55:00Z', now)).toMatch(/5 min/)
    expect(formatRelative('2026-09-26T12:00:00Z', now)).toMatch(/2 days ago/)
  })
})
