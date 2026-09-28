import { describe, expect, it } from 'vitest'

import { formatTime } from '@/lib/format'

import { timeZoneAt } from './timezone'

describe('timeZoneAt', () => {
  it('finds the zone at a start point', () => {
    expect(timeZoneAt([6.87, 45.92])).toBe('Europe/Paris')
    expect(timeZoneAt([-122.42, 37.77])).toBe('America/Los_Angeles')
  })

  it('falls back to the viewer zone without a valid point', () => {
    expect(timeZoneAt(undefined)).toBeUndefined()
    expect(timeZoneAt([0, 200])).toBeUndefined()
  })

  it('formats times in the hike zone', () => {
    const date = new Date('2026-07-01T18:00:00Z')
    expect(formatTime(date, 'Europe/Paris')).toBe(formatTime(new Date('2026-07-01T18:00:00Z'), 'Etc/GMT-2'))
    expect(formatTime(date, 'America/Los_Angeles')).toBe(formatTime(date, 'Etc/GMT+7'))
  })
})
