import { describe, expect, it } from 'vitest'

import { airTemps, conditionOf, conditionRuns, hourPlaces, tempRange, type WeatherHour } from './weather'

const hour = (time: string, tempC: number, code = 0): WeatherHour => ({
  time,
  lat: 0,
  lon: 0,
  tempC,
  feelsLikeC: tempC,
  precipMM: 0,
  snowCM: 0,
  windKmh: 0,
  gustKmh: 0,
  cloudPct: 0,
  code,
})

describe('conditionOf', () => {
  it('buckets WMO codes', () => {
    expect([0, 2, 3, 45, 53, 61, 81, 65, 82, 73, 86, 95].map(conditionOf)).toEqual([
      'clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'rain', 'heavyRain', 'heavyRain', 'snow', 'snow', 'storm',
    ])
  })
})

describe('hourPlaces', () => {
  const hours = [hour('2024-07-01T08:00:00Z', 10), hour('2024-07-01T09:00:00Z', 14), hour('2024-07-01T10:00:00Z', 6)]

  it('places points between the hours around them', () => {
    // Started 08:30; points at 08:30, 09:15, (no time), 10:20.
    const places = hourPlaces([0, 2700, null, 6600], '2024-07-01T08:30:00Z', hours)
    expect(places).toEqual([
      { k: 0, f: 0.5 },
      { k: 1, f: 0.25 },
      { k: 1, f: 0.25 },
      { k: 2, f: 0 },
    ])
    expect(airTemps(places!, hours)).toEqual([12, 12, 12, 6])
  })

  it('needs times and weather', () => {
    expect(hourPlaces(undefined, '2024-07-01T08:30:00Z', hours)).toBeNull()
    expect(hourPlaces([0], null, hours)).toBeNull()
    expect(hourPlaces([0], '2024-07-01T08:30:00Z', [])).toBeNull()
  })
})

describe('tempRange', () => {
  it('collapses an unchanged temperature', () => {
    const w = { minTempC: 7.6, maxTempC: 8.2, precipMM: 0, snowCM: 0, maxWindKmh: 0, maxGustKmh: 0, code: 0 }
    expect(tempRange(w)).toBe('8 °C')
    expect(tempRange({ ...w, minTempC: -2.4 })).toBe('-2–8 °C')
  })
})

describe('conditionRuns', () => {
  it('joins points under the same shaded condition, leaving fair weather out', () => {
    const hours = [hour('2024-07-01T08:00:00Z', 10, 0), hour('2024-07-01T09:00:00Z', 10, 61), hour('2024-07-01T10:00:00Z', 2, 73)]
    const places = [0, 0, 1, 1, 1, 2, 2].map((k) => ({ k, f: 0 }))
    expect(conditionRuns(places, hours)).toEqual([
      { from: 2, to: 5, condition: 'rain' },
      { from: 5, to: 6, condition: 'snow' },
    ])
  })
})
