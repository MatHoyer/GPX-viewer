import { Trophy } from 'lucide-react'
import { useMemo } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { personalRecords } from '@/features/stats/records'
import { useHikes } from '@/features/hikes/useHikes'

/** Shows which of the viewer's all-time records a hike holds, if it is one of theirs. */
export function RecordBadge({ hikeId }: { hikeId: string }) {
  const hikes = useHikes()
  const held = useMemo(
    () => personalRecords(hikes.data ?? []).filter((r) => r.hike.id === hikeId),
    [hikes.data, hikeId],
  )
  if (held.length === 0) return null

  const summary = held.length === 1 ? held[0].label : `${held.length} records`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        >
          <Trophy className="size-3.5" />
          {summary}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <ul>
          {held.map((r) => (
            <li key={r.key}>
              {r.label}: {r.value}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}
