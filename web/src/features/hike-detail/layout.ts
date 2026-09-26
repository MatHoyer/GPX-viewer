import type { Axis } from './profile'

/** Fixed chart geometry so overlays can map pixels to x without asking Recharts. */
export const CHART = {
  height: 92, // plot height, excluding the x axis
  yAxisWidth: 48,
  marginRight: 12,
  marginTop: 6,
  xAxisHeight: 20,
} as const

export function formatAxisX(axis: Axis, x: number): string {
  if (axis === 'time') {
    const h = Math.floor(x / 3600)
    const m = Math.floor((x % 3600) / 60)
    return `${h}:${String(m).padStart(2, '0')}`
  }
  return x >= 10_000 ? `${Math.round(x / 1000)} km` : `${(x / 1000).toFixed(1)} km`
}
