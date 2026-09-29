import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { MapPopup } from '@/components/ui/map'
import { formatDate, formatDistance, formatDuration, formatElevation } from '@/lib/format'

import type { Hike } from './api'
import { estimateNote, estimatedDurationS } from './estimate'
import { PlannedBadge } from './PlannedBadge'
import { TaggedBy } from './TaggedBy'

export type PopupState = {
  hikeId: string
  longitude: number
  latitude: number
  /** Distinguishes successive popups so a stale close event can't close a new one. */
  nonce: number
}

type Props = {
  hike: Hike
  userId: string | undefined
  popup: PopupState
  color: string
  onClose: (nonce: number) => void
}

export function HikePopup({ hike, userId, popup, color, onClose }: Props) {
  const { t } = useTranslation()
  const date = formatDate(hike.startedAt)
  return (
    <MapPopup
      longitude={popup.longitude}
      latitude={popup.latitude}
      onClose={() => onClose(popup.nonce)}
      closeButton
      className="w-64 p-4"
    >
      <div className="space-y-3">
        <div className="space-y-1 pr-5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <h3 className="truncate leading-tight font-semibold">{hike.name}</h3>
            {hike.planned && <PlannedBadge />}
          </div>
          {date && <p className="text-muted-foreground text-xs">{date}</p>}
          <TaggedBy hike={hike} userId={userId} />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label={t('hike.distance')} value={formatDistance(hike.distanceM)} />
          <Stat label={t('hikes.columns.gain')} value={formatElevation(hike.elevationGainM)} />
          {hike.planned ? (
            <Stat label={t('hike.estTime')} value={`~${formatDuration(estimatedDurationS(hike.distanceM))}`} title={estimateNote()} />
          ) : (
            <Stat label={t('hikes.columns.duration')} value={formatDuration(hike.durationS)} />
          )}
        </dl>
        <Button asChild size="sm" className="w-full">
          <Link to={`/hikes/${hike.id}`}>
            {t('hike.seeMore')}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </MapPopup>
  )
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="bg-muted/60 rounded-md px-1 py-1.5" title={title}>
      <dt className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}
