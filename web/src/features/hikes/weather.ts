import {
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Cloudy,
  Sun,
  type LucideIcon,
} from 'lucide-react'

import i18n from '@/i18n'
import { formatNumber } from '@/lib/format'

/** The weather during the hour starting at time, where the hiker was then. */
export type WeatherHour = {
  time: string
  lat: number
  lon: number
  tempC: number
  feelsLikeC: number
  precipMM: number
  snowCM: number
  windKmh: number
  gustKmh: number
  cloudPct: number
  /** WMO weather interpretation code. */
  code: number
}

export type WeatherSummary = {
  minTempC: number
  maxTempC: number
  precipMM: number
  snowCM: number
  maxWindKmh: number
  maxGustKmh: number
  /** The worst WMO code of the hike. */
  code: number
}

export type Condition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'heavyRain' | 'snow' | 'storm'

/** Buckets a WMO weather code. */
export function conditionOf(code: number): Condition {
  if (code <= 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code === 65 || code === 67 || code === 82) return 'heavyRain'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'cloudy'
}

export const conditionIcons: Record<Condition, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloudy,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  heavyRain: CloudRainWind,
  snow: CloudSnow,
  storm: CloudLightning,
}

export function conditionLabel(c: Condition): string {
  return i18n.t(`weather.${c}`)
}

const degrees = (v: number) => `${formatNumber(Math.round(v))} °C`

/** "4–12 °C", or "8 °C" when it barely changed. */
export function tempRange(w: WeatherSummary): string {
  const lo = Math.round(w.minTempC)
  const hi = Math.round(w.maxTempC)
  return lo === hi ? degrees(lo) : `${formatNumber(lo)}–${degrees(hi)}`
}

/** "Rain · 4 mm · gusts 45 km/h", leaving out what is negligible. */
export function weatherDetails(w: WeatherSummary): string {
  const t = i18n.t
  return [
    conditionLabel(conditionOf(w.code)),
    w.snowCM >= 0.5 ? t('weather.snowAmount', { value: formatNumber(Math.round(w.snowCM)) }) : null,
    w.precipMM >= 0.5 && w.snowCM < 0.5 ? t('weather.rainAmount', { value: formatNumber(Math.round(w.precipMM)) }) : null,
    w.maxGustKmh >= 30 ? t('weather.gusts', { value: formatNumber(Math.round(w.maxGustKmh)) }) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * For each profile point, its place between hourly rows: row k and the
 * fraction of the way to row k + 1. The profile's times are seconds since
 * startedAt; points without a time keep the previous place.
 */
export function hourPlaces(t: (number | null)[] | undefined, startedAt: string | null, hours: WeatherHour[] | undefined) {
  if (!t || !startedAt || !hours?.length) return null
  const t0 = new Date(startedAt).getTime()
  const times = hours.map((h) => new Date(h.time).getTime())
  const out: { k: number; f: number }[] = []
  let k = 0
  let prev = { k: 0, f: 0 }
  for (const s of t) {
    if (s !== null) {
      const at = t0 + s * 1000
      while (k + 1 < times.length && times[k + 1] <= at) k++
      const span = k + 1 < times.length ? times[k + 1] - times[k] : 0
      prev = { k, f: span > 0 ? Math.max(0, Math.min(1, (at - times[k]) / span)) : 0 }
    }
    out.push(prev)
  }
  return out
}

/** Air temperature at each profile point, interpolated between hours. */
export function airTemps(places: { k: number; f: number }[], hours: WeatherHour[]): number[] {
  return places.map(({ k, f }) => {
    const a = hours[k].tempC
    const b = hours[k + 1]?.tempC ?? a
    return a + (b - a) * f
  })
}
