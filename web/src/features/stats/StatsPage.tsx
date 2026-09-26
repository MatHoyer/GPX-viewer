import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useMe } from '@/features/auth/useAuth'
import { FilterBar } from '@/features/hikes/FilterBar'
import { filterHikes, useHikeFilters } from '@/features/hikes/filters'
import { useHikes } from '@/features/hikes/useHikes'
import { formatDistance, formatDuration, formatElevation } from '@/lib/format'

import {
  change,
  hikeYears,
  inYear,
  longestWeekStreak,
  metricValue,
  monthlyTotals,
  totals,
  yearlyTotals,
  type Metric,
  type Totals,
} from './stats'

const tick = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

const metrics: { value: Metric; label: string; format: (v: number) => string; axis: (v: number) => string }[] = [
  { value: 'distance', label: 'Distance', format: formatDistance, axis: (v) => `${tick.format(v / 1000)} km` },
  { value: 'gain', label: 'Elevation', format: formatElevation, axis: (v) => `${tick.format(v)} m` },
  { value: 'time', label: 'Time', format: formatDuration, axis: (v) => `${tick.format(v / 3600)}h` },
  { value: 'count', label: 'Hikes', format: (v) => String(v), axis: (v) => String(v) },
]

const monthNames = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(2024, i, 1)),
)

export function StatsPage() {
  const hikes = useHikes()
  const me = useMe()
  const filters = useHikeFilters((s) => s.filters)
  const [period, setPeriod] = useState<string>('all')
  const [metric, setMetric] = useState<Metric>('distance')

  const all = useMemo(() => hikes.data ?? [], [hikes.data])
  const shown = useMemo(() => filterHikes(all, filters, me.data?.id), [all, filters, me.data?.id])
  const years = useMemo(() => hikeYears(all), [all])
  const year = period === 'all' ? null : Number(period)

  const current = useMemo(() => totals(year === null ? shown : inYear(shown, year)), [shown, year])
  const previous = useMemo(() => (year === null ? null : totals(inYear(shown, year - 1))), [shown, year])
  const streak = useMemo(() => longestWeekStreak(year === null ? shown : inYear(shown, year)), [shown, year])
  const bars = useMemo(
    () =>
      year === null
        ? yearlyTotals(shown).map((y) => ({ label: String(y.year), totals: y.totals }))
        : monthlyTotals(shown, year).map((t, i) => ({ label: monthNames[i], totals: t })),
    [shown, year],
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">Stats</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger size="sm" className="w-32" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>
      {all.length > 0 && (
        <div className="border-b px-2 py-1.5 sm:px-4">
          <FilterBar hikes={all} userId={me.data?.id} matched={shown.length} />
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-4 p-4">
          {hikes.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : all.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">Import some hikes to see your stats.</p>
          ) : (
            <>
              <Tiles current={current} previous={previous} prevYear={year !== null ? year - 1 : null} streak={streak} />
              <section className="bg-card space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium">{year === null ? 'By year' : `By month in ${year}`}</h2>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    value={metric}
                    onValueChange={(v) => v && setMetric(v as Metric)}
                    aria-label="Metric"
                  >
                    {metrics.map((m) => (
                      <ToggleGroupItem key={m.value} value={m.value}>
                        {m.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <PeriodChart bars={bars} metric={metric} />
                <PeriodTable bars={bars} />
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function Tiles({
  current,
  previous,
  prevYear,
  streak,
}: {
  current: Totals
  previous: Totals | null
  prevYear: number | null
  streak: number
}) {
  const tiles = [
    { label: 'Hikes', value: String(current.count), metric: 'count' as const },
    { label: 'Distance', value: formatDistance(current.distanceM), metric: 'distance' as const },
    { label: 'Elevation gain', value: formatElevation(current.gainM), metric: 'gain' as const },
    { label: 'Time', value: formatDuration(current.timeS), metric: 'time' as const },
    { label: 'Active days', value: String(current.days) },
    { label: 'Longest streak', value: `${streak} ${streak === 1 ? 'week' : 'weeks'}` },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => {
        const delta =
          previous && t.metric ? change(metricValue(current, t.metric), metricValue(previous, t.metric)) : null
        return (
          <div key={t.label} className="bg-card rounded-xl border p-3">
            <p className="text-muted-foreground text-xs">{t.label}</p>
            <p className="text-xl font-semibold tabular-nums">{t.value}</p>
            {delta !== null && (
              <p className="text-muted-foreground flex items-center gap-0.5 text-xs tabular-nums">
                {delta >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {Math.abs(Math.round(delta * 100))}% vs {prevYear}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

type PeriodBar = { label: string; totals: Totals }

function PeriodChart({ bars, metric }: { bars: PeriodBar[]; metric: Metric }) {
  const def = metrics.find((m) => m.value === metric)!
  const data = bars.map((b) => ({ label: b.label, value: metricValue(b.totals, metric) }))
  return (
    <ChartContainer config={{ value: { label: def.label, color: 'var(--chart-bar)' } }} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis width={56} tickLine={false} axisLine={false} tickCount={4} tickFormatter={def.axis} allowDecimals={metric !== 'count'} />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltipContent formatter={(v) => def.format(Number(v))} indicator="dot" />}
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  )
}

function PeriodTable({ bars }: { bars: PeriodBar[] }) {
  return (
    <details className="text-sm">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer select-none">Show as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full tabular-nums">
          <thead className="text-muted-foreground text-xs">
            <tr className="border-b text-right [&>th]:py-1.5 [&>th]:font-medium">
              <th className="text-left">Period</th>
              <th>Hikes</th>
              <th>Distance</th>
              <th>Elevation</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {bars.map(({ label, totals: t }) => (
              <tr key={label} className="border-b text-right last:border-0 [&>td]:py-1.5">
                <td className="text-left">{label}</td>
                <td>{t.count}</td>
                <td>{t.count ? formatDistance(t.distanceM) : '—'}</td>
                <td>{t.count ? formatElevation(t.gainM) : '—'}</td>
                <td>{t.count ? formatDuration(t.timeS) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
