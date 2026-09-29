import { ZoomOut } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t, i18n } = useTranslation()
  const axis = useReplay((s) => s.axis)
  const range = useReplay((s) => s.range)
  const count = useReplay((s) => s.count)
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>('kmh')

  const xs = useMemo(() => xValues(profile, axis), [profile, axis])
  // Labels and units follow the language.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const series = useMemo(() => buildSeries(profile, speedUnit), [profile, speedUnit, i18n.language])
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
          aria-label={t('charts.xAxis')}
        >
          <ToggleGroupItem value="dist">{t('hike.distance')}</ToggleGroupItem>
          <ToggleGroupItem value="time" disabled={!profile.has.time}>
            {t('charts.time')}
          </ToggleGroupItem>
        </ToggleGroup>
        <Button variant="ghost" size="sm" disabled={!range} onClick={() => useReplay.getState().setRange(null)}>
          <ZoomOut />
          {t('charts.resetZoom')}
        </Button>
      </div>

      {series.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">{t('charts.noData')}</p>
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
                  aria-label={t('charts.speedUnit')}
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
            <ChartOverlay xs={xs} domain={domain} showXAxis={i === series.length - 1} bands={bands} bandIcons={i === 0} />
          </div>
        </section>
      ))}

      <RangeBrush xs={xs} values={profile.ele} />
    </div>
  )
}
