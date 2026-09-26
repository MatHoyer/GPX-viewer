import { valueAt } from './profile'
import type { SeriesDef } from './series'
import { useReplay } from './store'

/** Live value of a series at the hover position, or at the replay head. */
export function ChartValue({ series }: { series: SeriesDef }) {
  const hover = useReplay((s) => s.hover)
  const pos = useReplay((s) => s.pos)
  const v = valueAt(series.values, hover ?? pos)
  return (
    <span className="text-foreground font-medium tabular-nums" style={{ color: hover === null ? undefined : series.color }}>
      {v === null ? '—' : series.format(v)}
    </span>
  )
}
