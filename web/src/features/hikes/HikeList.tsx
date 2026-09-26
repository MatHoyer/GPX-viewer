import { Clock, MoveUpRight, Route, Trash2 } from 'lucide-react'

import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { formatDate, formatDistance, formatDuration, formatElevation } from '@/lib/format'

import type { Hike } from './api'
import { hikeColor } from './colors'

type Props = {
  hikes: Hike[] | undefined
  isLoading: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  onDelete: (hike: Hike) => void
}

export function HikeList({ hikes, isLoading, selectedId, onSelect, onHover, onDelete }: Props) {
  if (isLoading) {
    return (
      <SidebarMenu>
        {Array.from({ length: 4 }, (_, i) => (
          <SidebarMenuItem key={i}>
            <SidebarMenuSkeleton />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    )
  }

  if (!hikes?.length) {
    return (
      <p className="text-muted-foreground px-2 py-6 text-center text-sm">
        No hikes yet. Import GPX files to see them on the map.
      </p>
    )
  }

  return (
    <SidebarMenu>
      {hikes.map((hike, i) => {
        const date = formatDate(hike.startedAt)
        return (
          <SidebarMenuItem key={hike.id} onMouseEnter={() => onHover(hike.id)} onMouseLeave={() => onHover(null)}>
            <SidebarMenuButton
              size="lg"
              isActive={hike.id === selectedId}
              onClick={() => onSelect(hike.id === selectedId ? null : hike.id)}
              className="h-auto items-start py-2"
            >
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: hikeColor(i) }} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-medium">{hike.name}</span>
                <span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Route className="size-3" />
                    {formatDistance(hike.distanceM)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MoveUpRight className="size-3" />
                    {formatElevation(hike.elevationGainM)}
                  </span>
                  {hike.durationS > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDuration(hike.durationS)}
                    </span>
                  )}
                </span>
                {date && <span className="text-muted-foreground text-xs">{date}</span>}
              </span>
            </SidebarMenuButton>
            <SidebarMenuAction showOnHover onClick={() => onDelete(hike)} aria-label={`Delete ${hike.name}`}>
              <Trash2 />
            </SidebarMenuAction>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
