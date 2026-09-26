import { useRef, useState } from 'react'

import { SidebarTrigger } from '@/components/ui/sidebar'

import type { PopupState } from './HikePopup'
import { HikesMap } from './HikesMap'
import { useHikes, useTracks } from './useHikes'

export function MapPage() {
  const hikes = useHikes()
  const tracks = useTracks()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const nonce = useRef(0)

  function openPopup(hikeId: string, longitude: number, latitude: number) {
    setPopup({ hikeId, longitude, latitude, nonce: ++nonce.current })
  }

  function closePopup(closedNonce: number) {
    setPopup((p) => (p?.nonce === closedNonce ? null : p))
  }

  return (
    <>
      <SidebarTrigger className="bg-background absolute top-2 left-2 z-10 shadow-sm" variant="outline" />
      <HikesMap
        hikes={hikes.data ?? []}
        tracks={tracks.data}
        selectedId={popup?.hikeId ?? null}
        hoveredId={hoveredId}
        popup={popup}
        onRouteClick={openPopup}
        onHover={setHoveredId}
        onPopupClose={closePopup}
      />
    </>
  )
}
