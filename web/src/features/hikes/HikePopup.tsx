import { ArrowRight, Clock, MoveUpRight, Route } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { MapPopup } from '@/components/ui/map'
import { formatDate, formatDistance, formatDuration, formatElevation } from '@/lib/format'

import type { Hike } from './api'
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
          </div>
          {date && <p className="text-muted-foreground text-xs">{date}</p>}
          <TaggedBy hike={hike} userId={userId} />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat icon={<Route className="size-3.5" />} label="Distance" value={formatDistance(hike.distanceM)} />
          <Stat icon={<MoveUpRight className="size-3.5" />} label="D+" value={formatElevation(hike.elevationGainM)} />
          <Stat icon={<Clock className="size-3.5" />} label="Duration" value={formatDuration(hike.durationS)} />
        </dl>
        <Button asChild size="sm" className="w-full">
          <Link to={`/hikes/${hike.id}`}>
            See more
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </MapPopup>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-muted/60 rounded-md px-1 py-1.5">
      <dt className="text-muted-foreground flex items-center justify-center gap-1 text-[10px] tracking-wide uppercase">
        {icon}
        {label}
      </dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}
