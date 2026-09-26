import { MountainSnow } from 'lucide-react'

import type { Peak } from '@/features/stats/summits'
import { formatElevation } from '@/lib/format'

/** The named peaks a hike went over, highest first. */
export function HikeSummits({ peaks }: { peaks: Peak[] }) {
  if (peaks.length === 0) return null
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Summits reached">
      {peaks.map((p) => (
        <li key={p.id} className="bg-card flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
          <MountainSnow className="text-muted-foreground size-3.5" />
          {p.name}
          {p.eleM !== null && <span className="text-muted-foreground tabular-nums">{formatElevation(p.eleM)}</span>}
        </li>
      ))}
    </ul>
  )
}
