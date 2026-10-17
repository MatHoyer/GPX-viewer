import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { MapRoute } from '@/components/ui/map'
import { linesBetween, type Profile } from '@/features/hike-detail/profile'
import { ESTIMATED_SPEED_KMH } from '@/features/hikes/estimate'
import { formatDistance, formatElevation, formatTime } from '@/lib/format'

import { gainAfter, type RouteProgress } from './route'
import type { Totals } from './track'
import { useNow } from './useNow'

const ROUTE_COLOR = '#2e86ab'
/** Below this the walk so far says little about the pace; the default estimate is used. */
const MIN_PACE_DISTANCE_M = 1000

/** The planned route under the recorded track. */
export function PlannedRouteLine({ profile }: { profile: Profile }) {
  const lines = useMemo(() => linesBetween(profile, 0, profile.lon.length - 1), [profile])
  return lines.map((line, i) => (
    <MapRoute key={i} id={`planned-${i}`} coordinates={line} color={ROUTE_COLOR} width={5} opacity={0.6} dashArray={[2, 1.5]} interactive={false} />
  ))
}

type Props = { profile: Profile; progress: RouteProgress | null; walked: Totals }

/** Distance and climb left on the route, the arrival time and the elevation ahead. */
export function RoutePanel({ profile, progress, walked }: Props) {
  const { t } = useTranslation()
  const total = profile.dist[profile.dist.length - 1] ?? 0
  const index = progress?.index ?? 0
  const leftM = Math.max(0, total - profile.dist[index])
  const speedMS =
    walked.distanceM >= MIN_PACE_DISTANCE_M && walked.durationS > 0 ? walked.distanceM / walked.durationS : ESTIMATED_SPEED_KMH / 3.6
  const now = useNow(30_000)
  const arrival = new Date(now + (leftM / speedMS) * 1000)

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground flex justify-between gap-2 text-xs tabular-nums">
        <span>{t('record.left', { distance: formatDistance(leftM), gain: formatElevation(gainAfter(profile, index)) })}</span>
        <span>{t('record.arrival', { time: formatTime(arrival) })}</span>
      </p>
      {profile.has.ele && <ElevationAhead profile={profile} index={index} />}
    </div>
  )
}

const W = 300
const H = 48

/** The route's elevation, walked part shaded, with a line where you are. */
function ElevationAhead({ profile, index }: { profile: Profile; index: number }) {
  const { t } = useTranslation()
  const path = useMemo(() => {
    const ele = profile.ele ?? []
    const known = ele.filter((e): e is number => e !== null)
    const min = Math.min(...known)
    const span = Math.max(1, Math.max(...known) - min)
    const total = profile.dist[profile.dist.length - 1] || 1
    const xs = profile.dist.map((d) => (d / total) * W)
    const ys = ele.map((e) => (e === null ? null : H - 2 - ((e - min) / span) * (H - 4)))
    return { xs, ys, d: xs.map((x, i) => (ys[i] === null ? '' : `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i]!.toFixed(1)}`)).join('') }
  }, [profile])
  const x = path.xs[index] ?? 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-12 w-full" role="img" aria-label={t('record.elevationAhead')}>
      <clipPath id="walked">
        <rect width={x} height={H} />
      </clipPath>
      <path d={`${path.d}L${W},${H}L0,${H}Z`} fill={ROUTE_COLOR} opacity={0.15} />
      <path d={`${path.d}L${W},${H}L0,${H}Z`} fill={ROUTE_COLOR} opacity={0.35} clipPath="url(#walked)" />
      <path d={path.d} fill="none" stroke={ROUTE_COLOR} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={x} x2={x} y1={0} y2={H} stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
