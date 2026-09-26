import { formatDistance, formatDuration, formatElevation } from '@/lib/format'

import type { ProfileSummary } from './profile'

type Stat = { label: string; value: string; hint?: string }

export function HikeStats({ summary }: { summary: ProfileSummary }) {
  const s = summary
  const stats = [
    { label: 'Distance', value: formatDistance(s.distanceM) },
    s.maxEle !== null && {
      label: 'Elevation',
      value: `+${formatElevation(s.elevationGainM)}`,
      hint: `−${formatElevation(s.elevationLossM)}`,
    },
    s.elapsedS !== null && {
      label: 'Duration',
      value: formatDuration(s.elapsedS),
      hint: s.movingS !== null ? `${formatDuration(s.movingS)} moving` : undefined,
    },
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
