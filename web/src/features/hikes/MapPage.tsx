import { useMemo } from 'react'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { useMe } from '@/features/auth/useAuth'

import { FilterBar } from './FilterBar'
import { filterHikes, useHikeFilters } from './filters'
import { HikesMapView } from './HikesMapView'
import { useHikes, useTracks } from './useHikes'

export function MapPage() {
  const me = useMe()
  const hikes = useHikes()
  const tracks = useTracks()
  const filters = useHikeFilters((s) => s.filters)
  const userId = me.data?.id

  const all = useMemo(() => hikes.data ?? [], [hikes.data])
  const shown = useMemo(() => filterHikes(all, filters, userId), [all, filters, userId])
  const shownTracks = useMemo(() => {
    if (!tracks.data || shown === all) return tracks.data
    const ids = new Set(shown.map((h) => h.id))
    return { ...tracks.data, features: tracks.data.features.filter((f) => ids.has(f.properties.id)) }
  }, [tracks.data, shown, all])

  return (
    <>
      <div className="absolute top-2 right-14 left-2 z-10 flex items-center gap-1.5">
        <SidebarTrigger className="bg-background shadow-sm" variant="outline" />
        {all.length > 0 && <FilterBar hikes={all} userId={userId} matched={shown.length} className="min-w-0" />}
      </div>
      {all.length > 0 && shown.length === 0 && (
        <p className="bg-background/90 text-muted-foreground absolute top-14 left-1/2 z-10 -translate-x-1/2 rounded-lg border px-3 py-1.5 text-sm shadow-sm">
          No hikes match these filters.
        </p>
      )}
      <HikesMapView hikes={shown} colorFrom={all} tracks={shownTracks} userId={userId} />
    </>
  )
}
