import { ZoomOut } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { ChartOverlay } from './ChartOverlay'
import { ChartValue } from './ChartValue'
import { ProfileChart } from './ProfileChart'
import { xAt, xValues, type Axis, type Profile } from './profile'
import { RangeBrush } from './RangeBrush'
import { buildSeries, type SpeedUnit } from './series'
import { useReplay, visibleSpan } from './store'
import { lightBands } from './sun'

/** startedAt places the profile's relative times in the day, to shade night. */
export function ProfileCharts({ profile, startedAt }: { profile: Profile; startedAt: string | null }) {
  const axis = useReplay((s) => s.axis)
  const range = useReplay((s) => s.range)
  const count = useReplay((s) => s.count)
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>('kmh')

  const xs = useMemo(() => xValues(profile, axis), [profile, axis])
  const series = useMemo(() => buildSeries(profile, speedUnit), [profile, speedUnit])
  const bands = useMemo(() => lightBands(profile, startedAt), [profile, startedAt])
  const [lo, hi] = visibleSpan({ range, count })
  const domain = useMemo<[number, number]>(() => [xAt(xs, lo), xAt(xs, hi)], [xs, lo, hi])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={axis}
          onValueChange={(v) => v && useReplay.getState().setAxis(v as Axis)}
          aria-label="X axis"
        >
          <ToggleGroupItem value="dist">Distance</ToggleGroupItem>
          <ToggleGroupItem value="time" disabled={!profile.has.time}>
            Time
          </ToggleGroupItem>
        </ToggleGroup>
        {bands.length > 0 && (
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="bg-foreground/[0.07] size-3 rounded-sm border" />
              Twilight
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-foreground/15 size-3 rounded-sm border" />
              Night
            </span>
          </div>
        )}
        <Button variant="ghost" size="sm" disabled={!range} onClick={() => useReplay.getState().setRange(null)}>
          <ZoomOut />
          Reset zoom
        </Button>
      </div>

      {series.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">This GPX has no elevation, time or sensor data to chart.</p>
      )}

      {series.map((s, i) => (
        <section key={s.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              <h3 className="text-muted-foreground font-medium">{s.label}</h3>
              {s.key === 'speed' && (
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={speedUnit}
                  onValueChange={(v) => v && setSpeedUnit(v as SpeedUnit)}
                  className="h-6"
                  aria-label="Speed unit"
                >
                  <ToggleGroupItem value="kmh" className="h-6 px-2 text-xs">
                    km/h
                  </ToggleGroupItem>
                  <ToggleGroupItem value="pace" className="h-6 px-2 text-xs">
                    min/km
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>
            <ChartValue series={s} />
          </div>
          <div className="relative">
            <ProfileChart series={s} xs={xs} domain={domain} axis={axis} showXAxis={i === series.length - 1} />
            <ChartOverlay xs={xs} domain={domain} showXAxis={i === series.length - 1} bands={bands} />
          </div>
        </section>
      ))}

      <RangeBrush xs={xs} values={profile.ele} />
    </div>
  )
}
