import { ESTIMATE_NOTE, estimatedDurationS } from '@/features/hikes/estimate'
import { formatDistance, formatDuration, formatElevation, formatTime } from '@/lib/format'

import type { ProfileSummary } from './profile'
import { daylightAt } from './sun'

type Stat = { label: string; value: string; hint?: string }

type Props = {
  summary: ProfileSummary
  planned?: boolean
  startedAt?: string | null
  /** Where the hike starts, [lon, lat], for its sunrise and sunset. */
  start?: [number, number]
  /** The hike's own time zone; the viewer's when undefined. */
  timeZone?: string
}

/** Sunrise and sunset where and when a walked hike started. */
function daylightStat(startedAt: string, [lon, lat]: [number, number], timeZone?: string): Stat {
  const d = daylightAt(startedAt, lat, lon)
  if (d.alwaysUp) return { label: 'Daylight', value: 'All day', hint: 'Midnight sun' }
  if (d.alwaysDown) return { label: 'Daylight', value: 'None', hint: 'Polar night' }
  return {
    label: 'Sunrise',
    value: d.sunrise ? formatTime(d.sunrise, timeZone) : '—',
    hint: d.sunset ? `sunset ${formatTime(d.sunset, timeZone)}` : undefined,
  }
}

/** A planned route has no times of its own, so its duration is estimated from its distance. */
export function HikeStats({ summary, planned = false, startedAt = null, start, timeZone }: Props) {
  const s = summary
  const stats = [
    { label: 'Distance', value: formatDistance(s.distanceM) },
    s.maxEle !== null && {
      label: 'Elevation',
      value: `+${formatElevation(s.elevationGainM)}`,
      hint: `−${formatElevation(s.elevationLossM)}`,
    },
    planned && {
      label: 'Est. duration',
      value: `~${formatDuration(estimatedDurationS(s.distanceM))}`,
      hint: ESTIMATE_NOTE,
    },
    s.elapsedS !== null && {
      label: 'Duration',
      value: formatDuration(s.elapsedS),
      hint: s.movingS !== null ? `${formatDuration(s.movingS)} moving` : undefined,
    },
    !planned && startedAt && start && daylightStat(startedAt, start, timeZone),
    s.avgSpeedMS !== null && {
      label: 'Avg speed',
      value: `${(s.avgSpeedMS * 3.6).toFixed(1)} km/h`,
      hint: s.maxSpeedMS !== null ? `max ${(s.maxSpeedMS * 3.6).toFixed(1)}` : undefined,
    },
    s.maxEle !== null && {
      label: 'Highest point',
      value: formatElevation(s.maxEle),
      hint: s.minEle !== null ? `lowest ${formatElevation(s.minEle)}` : undefined,
    },
    s.avgHR !== null && { label: 'Heart rate', value: `${Math.round(s.avgHR)} bpm`, hint: s.maxHR !== null ? `max ${Math.round(s.maxHR)}` : undefined },
    s.avgCad !== null && { label: 'Cadence', value: `${Math.round(s.avgCad)} spm` },
    s.avgTemp !== null && { label: 'Temperature', value: `${s.avgTemp.toFixed(1)} °C` },
  ].filter(Boolean) as Stat[]

  return (
    // Cards stretch to fill the row; on phones an odd last card spans both columns.
    <dl className="grid grid-cols-2 gap-3 max-sm:[&>:last-child:nth-child(odd)]:col-span-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card rounded-lg border px-3 py-2.5">
          <dt className="text-muted-foreground text-xs">{stat.label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
          {stat.hint && <dd className="text-muted-foreground text-xs tabular-nums">{stat.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}
