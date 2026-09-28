import { describe, expect, it } from 'vitest'

import { formatTime } from '@/lib/format'

import { fromLocalInput, timeZoneAt, toLocalInput } from './timezone'

describe('timeZoneAt', () => {
  it('finds the zone at a start point', async () => {
    expect(await timeZoneAt([6.87, 45.92])).toBe('Europe/Paris')
    expect(await timeZoneAt([-122.42, 37.77])).toBe('America/Los_Angeles')
  })

  it('falls back to the viewer zone without a valid point', async () => {
    expect(await timeZoneAt(undefined)).toBeUndefined()
    expect(await timeZoneAt([0, 200])).toBeUndefined()
  })

  it('formats times in the hike zone', () => {
    const date = new Date('2026-07-01T18:00:00Z')
    expect(formatTime(date, 'Europe/Paris')).toBe(formatTime(new Date('2026-07-01T18:00:00Z'), 'Etc/GMT-2'))
    expect(formatTime(date, 'America/Los_Angeles')).toBe(formatTime(date, 'Etc/GMT+7'))
  })
})

describe('local input values', () => {
  it('round-trips a wall-clock time in the hike zone', () => {
    const date = fromLocalInput('2026-07-01T08:00', 'Europe/Paris')
    expect(date?.toISOString()).toBe('2026-07-01T06:00:00.000Z')
    expect(toLocalInput(date!, 'Europe/Paris')).toBe('2026-07-01T08:00')
  })

  it('follows daylight saving time', () => {
    expect(fromLocalInput('2026-01-15T08:00', 'America/Los_Angeles')?.toISOString()).toBe('2026-01-15T16:00:00.000Z')
    expect(fromLocalInput('2026-07-15T08:00', 'America/Los_Angeles')?.toISOString()).toBe('2026-07-15T15:00:00.000Z')
  })

  it('rejects empty values', () => {
    expect(fromLocalInput('', 'Europe/Paris')).toBeNull()
  })
})
