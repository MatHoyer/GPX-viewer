import { memo, useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { ChartContainer } from '@/components/ui/chart'

import { CHART, formatAxisX } from './layout'
import type { Axis } from './profile'
import type { SeriesDef } from './series'

type Props = {
  series: SeriesDef
  xs: number[]
  domain: [number, number]
  axis: Axis
  /** Only the bottom chart shows x labels; the others share its scale. */
  showXAxis: boolean
}

/**
 * Static Recharts rendering of one series. Memoized: it only re-renders when
 * data, zoom or axis change — never on replay ticks or hover.
 */
export const ProfileChart = memo(function ProfileChart({ series, xs, domain, axis, showXAxis }: Props) {
  const rows = useMemo(() => {
    const out: { x: number; y: number | null }[] = []
    for (let i = 0; i < xs.length; i++) {
      // Keep one point beyond each edge so lines reach the plot borders.
      const inside = xs[i] >= domain[0] && xs[i] <= domain[1]
      const edge = (xs[i + 1] ?? Infinity) >= domain[0] && (xs[i - 1] ?? -Infinity) <= domain[1]
      if (inside || edge) out.push({ x: xs[i], y: series.values[i] })
    }
    return out
  }, [xs, series.values, domain])

  const margin = { top: CHART.marginTop, right: CHART.marginRight, bottom: 0, left: 0 }
  const xAxis = (
    <XAxis
      dataKey="x"
      type="number"
      domain={domain}
      allowDataOverflow
      height={showXAxis ? CHART.xAxisHeight : 0}
      hide={!showXAxis}
      tickLine={false}
      axisLine={false}
      minTickGap={40}
      tickFormatter={(x: number) => formatAxisX(axis, x)}
    />
  )
  const yAxis = (
    <YAxis
      width={CHART.yAxisWidth}
      domain={['auto', 'auto']}
      reversed={series.reversed}
      tickLine={false}
      axisLine={false}
      tickCount={3}
      tickFormatter={(v: number) => series.format(v).split(' ')[0]}
    />
  )
  const grid = <CartesianGrid vertical={false} strokeDasharray="3 3" />

  return (
    <ChartContainer
      config={{ y: { label: series.label, color: series.color } }}
      className="aspect-auto w-full"
      style={{ height: CHART.height + (showXAxis ? CHART.xAxisHeight : 0) }}
    >
      {series.kind === 'area' ? (
        <AreaChart data={rows} margin={margin}>
          <defs>
            <linearGradient id={`fill-${series.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series.color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={series.color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          {grid}
          {xAxis}
          {yAxis}
          <Area
            dataKey="y"
            type="monotone"
            stroke={series.color}
            strokeWidth={1.5}
            fill={`url(#fill-${series.key})`}
            isAnimationActive={false}
            connectNulls
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      ) : (
        <LineChart data={rows} margin={margin}>
          {grid}
          {xAxis}
          {yAxis}
          <Line
            dataKey="y"
            type="monotone"
            stroke={series.color}
            strokeWidth={1.5}
            isAnimationActive={false}
            connectNulls={false}
            dot={false}
            activeDot={false}
          />
        </LineChart>
      )}
    </ChartContainer>
  )
})
