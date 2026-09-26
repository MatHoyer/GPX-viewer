import { SidebarTrigger } from '@/components/ui/sidebar'
import { useMe } from '@/features/auth/useAuth'

import { HikesMapView } from './HikesMapView'
import { useHikes, useTracks } from './useHikes'

export function MapPage() {
  const me = useMe()
  const hikes = useHikes()
  const tracks = useTracks()

  return (
    <>
      <SidebarTrigger className="bg-background absolute top-2 left-2 z-10 shadow-sm" variant="outline" />
      <HikesMapView hikes={hikes.data ?? []} tracks={tracks.data} userId={me.data?.id} />
    </>
  )
}
