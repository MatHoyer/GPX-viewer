import { formatPace } from '@/lib/format'

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

const round = (v: number, digits = 0) => v.toFixed(digits)

/** Chart series available for a profile, in display order. */
export function buildSeries(p: Profile, speedUnit: SpeedUnit): SeriesDef[] {
  const out: SeriesDef[] = []
  if (p.has.ele && p.ele) {
    out.push({ key: 'ele', label: 'Elevation', color: 'var(--chart-ele)', kind: 'area', values: p.ele, format: (v) => `${round(v)} m` })
  }
  if (p.has.time && p.speed) {
    out.push(
      speedUnit === 'kmh'
        ? { key: 'speed', label: 'Speed', color: 'var(--chart-speed)', kind: 'line', values: p.speed.map(speedKmh), format: (v) => `${round(v, 1)} km/h` }
        : { key: 'speed', label: 'Pace', color: 'var(--chart-speed)', kind: 'line', values: p.speed.map(paceMinPerKm), format: (v) => `${formatPace(v)} /km`, reversed: true },
    )
  }
  if (p.has.hr && p.hr) {
    out.push({ key: 'hr', label: 'Heart rate', color: 'var(--chart-hr)', kind: 'line', values: p.hr, format: (v) => `${round(v)} bpm` })
  }
  if (p.has.cad && p.cad) {
    out.push({ key: 'cad', label: 'Cadence', color: 'var(--chart-cad)', kind: 'line', values: p.cad, format: (v) => `${round(v)} spm` })
  }
  if (p.has.temp && p.temp) {
    out.push({ key: 'temp', label: 'Temperature', color: 'var(--chart-temp)', kind: 'line', values: p.temp, format: (v) => `${round(v, 1)} °C` })
  }
  return out
}
