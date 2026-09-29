import i18n from '@/i18n'
import { formatNumber, formatPace } from '@/lib/format'

import { paceMinPerKm, speedKmh, type Profile, type Series } from './profile'

export type SpeedUnit = 'kmh' | 'pace'

export type SeriesDef = {
  key: string
  label: string
  color: string
  kind: 'area' | 'line'
  values: Series
  format: (v: number) => string
  /** Pace charts read better with the fastest values on top. */
  reversed?: boolean
}

const round = (v: number, digits = 0) => formatNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Chart series available for a profile, in display order. */
export function buildSeries(p: Profile, speedUnit: SpeedUnit): SeriesDef[] {
  const t = i18n.t
  const out: SeriesDef[] = []
  if (p.has.ele && p.ele) {
    out.push({ key: 'ele', label: t('series.elevation'), color: 'var(--chart-ele)', kind: 'area', values: p.ele, format: (v) => `${round(v)} m` })
  }
  if (p.has.time && p.speed) {
    out.push(
      speedUnit === 'kmh'
        ? { key: 'speed', label: t('series.speed'), color: 'var(--chart-speed)', kind: 'line', values: p.speed.map(speedKmh), format: (v) => `${round(v, 1)} km/h` }
        : { key: 'speed', label: t('series.pace'), color: 'var(--chart-speed)', kind: 'line', values: p.speed.map(paceMinPerKm), format: (v) => `${formatPace(v)} /km`, reversed: true },
    )
  }
  if (p.has.hr && p.hr) {
    out.push({ key: 'hr', label: t('series.heartRate'), color: 'var(--chart-hr)', kind: 'line', values: p.hr, format: (v) => `${round(v)} bpm` })
  }
  if (p.has.cad && p.cad) {
    out.push({ key: 'cad', label: t('series.cadence'), color: 'var(--chart-cad)', kind: 'line', values: p.cad, format: (v) => `${round(v)} spm` })
  }
  if (p.has.temp && p.temp) {
    out.push({ key: 'temp', label: t('series.temperature'), color: 'var(--chart-temp)', kind: 'line', values: p.temp, format: (v) => `${round(v, 1)} °C` })
  }
  return out
}
