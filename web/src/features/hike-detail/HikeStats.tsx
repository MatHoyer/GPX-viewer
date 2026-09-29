import { useTranslation } from 'react-i18next'

import { estimateNote, estimatedDurationS } from '@/features/hikes/estimate'
import i18n from '@/i18n'
import { formatDistance, formatDuration, formatElevation, formatNumber, formatTime } from '@/lib/format'

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
  const t = i18n.t
  if (d.alwaysUp) return { label: t('stat.daylight'), value: t('stat.allDay'), hint: t('stat.midnightSun') }
  if (d.alwaysDown) return { label: t('stat.daylight'), value: t('stat.none'), hint: t('stat.polarNight') }
  return {
    label: t('stat.sunrise'),
    value: d.sunrise ? formatTime(d.sunrise, timeZone) : '—',
    hint: d.sunset ? t('stat.sunset', { time: formatTime(d.sunset, timeZone) }) : undefined,
  }
}

/** A planned route has no times of its own, so its duration is estimated from its distance. */
export function HikeStats({ summary, planned = false, startedAt = null, start, timeZone }: Props) {
  const { t } = useTranslation()
  const s = summary
  const oneDecimal = (n: number) => formatNumber(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const stats = [
    { label: t('hike.distance'), value: formatDistance(s.distanceM) },
    s.maxEle !== null && {
      label: t('stat.elevation'),
      value: `+${formatElevation(s.elevationGainM)}`,
      hint: `−${formatElevation(s.elevationLossM)}`,
    },
    planned && {
      label: t('stat.estDuration'),
      value: `~${formatDuration(estimatedDurationS(s.distanceM))}`,
      hint: estimateNote(),
    },
    s.elapsedS !== null && {
      label: t('hikes.columns.duration'),
      value: formatDuration(s.elapsedS),
      hint: s.movingS !== null ? t('stat.moving', { duration: formatDuration(s.movingS) }) : undefined,
    },
    !planned && startedAt && start && daylightStat(startedAt, start, timeZone),
    s.avgSpeedMS !== null && {
      label: t('stat.avgSpeed'),
      value: `${oneDecimal(s.avgSpeedMS * 3.6)} km/h`,
      hint: s.maxSpeedMS !== null ? t('stat.max', { value: oneDecimal(s.maxSpeedMS * 3.6) }) : undefined,
    },
    s.maxEle !== null && {
      label: t('stat.highest'),
      value: formatElevation(s.maxEle),
      hint: s.minEle !== null ? t('stat.lowest', { value: formatElevation(s.minEle) }) : undefined,
    },
    s.avgHR !== null && {
      label: t('stat.heartRate'),
      value: `${Math.round(s.avgHR)} bpm`,
      hint: s.maxHR !== null ? t('stat.max', { value: Math.round(s.maxHR) }) : undefined,
    },
    s.avgCad !== null && { label: t('stat.cadence'), value: `${Math.round(s.avgCad)} spm` },
    s.avgTemp !== null && { label: t('stat.temperature'), value: `${oneDecimal(s.avgTemp)} °C` },
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
