import { useMemo } from 'react'

import { Map, MapControls, MapRoute } from '@/components/ui/map'

import type { Hike, Tracks } from './api'
import { hikeColor } from './colors'
import { unionBounds } from './bounds'
import { FitBounds } from './FitBounds'
import { HikePopup, type PopupState } from './HikePopup'

type Props = {
  hikes: Hike[]
  userId: string | undefined
  tracks: Tracks | undefined
  selectedId: string | null
  hoveredId: string | null
  popup: PopupState | null
  onRouteClick: (id: string, longitude: number, latitude: number) => void
  onHover: (id: string | null) => void
  onPopupClose: (nonce: number) => void
}

export function HikesMap({ hikes, userId, tracks, selectedId, hoveredId, popup, onRouteClick, onHover, onPopupClose }: Props) {
  const colorById = useMemo(() => new globalThis.Map(hikes.map((h, i) => [h.id, hikeColor(i)])), [hikes])
  const popupHike = popup ? hikes.find((h) => h.id === popup.hikeId) : undefined

  const fitTarget = useMemo(() => {
    const selected = hikes.find((h) => h.id === selectedId)
    return selected ? selected.bounds : unionBounds(hikes.map((h) => h.bounds))
  }, [hikes, selectedId])

  return (
    <Map center={[2.35, 46.6]} zoom={5} className="size-full">
      <MapControls position="bottom-right" showZoom showCompass showLocate showFullscreen />
      <FitBounds bounds={fitTarget} />
      {tracks?.features.flatMap((feature) => {
        const id = feature.properties.id
        const highlighted = id === selectedId || id === hoveredId
        const dimmed = selectedId !== null && !highlighted
        return feature.geometry.coordinates.map((line, i) => (
          <MapRoute
            key={`${id}-${i}`}
            id={`hike-${id}-${i}`}
            coordinates={line as [number, number][]}
            color={colorById.get(id) ?? hikeColor(0)}
            width={3}
            opacity={dimmed ? 0.35 : 0.85}
            active={highlighted}
            activeWidth={5}
            activeOpacity={1}
            onClick={(e) => onRouteClick(id, e.lngLat.lng, e.lngLat.lat)}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
          />
        ))
      })}
      {popup && popupHike && (
        <HikePopup
          key={popup.nonce}
          hike={popupHike}
          userId={userId}
          popup={popup}
          color={colorById.get(popupHike.id) ?? hikeColor(0)}
          onClose={onPopupClose}
        />
      )}
    </Map>
  )
}
