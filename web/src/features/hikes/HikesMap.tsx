import { useMemo } from 'react'

import { MapControls, MapRoute } from '@/components/ui/map'
import { useMapView } from '@/features/map/basemaps'
import { HeatmapLayer } from '@/features/map/HeatmapLayer'
import { LayeredMap } from '@/features/map/LayeredMap'

import type { Hike, Tracks } from './api'
import { hikeColor } from './colors'
import { unionBounds } from './bounds'
import { FitBounds } from './FitBounds'
import { HikePopup, type PopupState } from './HikePopup'

type Props = {
  hikes: Hike[]
  /** Hikes that set colors, so a hike keeps its color when others are filtered out. Defaults to `hikes`. */
  colorFrom?: Hike[]
  userId: string | undefined
  tracks: Tracks | undefined
  selectedId: string | null
  hoveredId: string | null
  popup: PopupState | null
  onRouteClick: (id: string, longitude: number, latitude: number) => void
  onHover: (id: string | null) => void
  onPopupClose: (nonce: number) => void
}

export function HikesMap({ hikes, colorFrom, userId, tracks, selectedId, hoveredId, popup, onRouteClick, onHover, onPopupClose }: Props) {
  const colorById = useMemo(
    () => new globalThis.Map((colorFrom ?? hikes).map((h, i) => [h.id, hikeColor(i)])),
    [colorFrom, hikes],
  )
  const popupHike = popup ? hikes.find((h) => h.id === popup.hikeId) : undefined
  const heatmap = useMapView((s) => s.heatmap)
  const lines = useMemo(
    () => (tracks?.features ?? []).flatMap((f) => f.geometry.coordinates as [number, number][][]),
    [tracks],
  )

  const fitTarget = useMemo(() => {
    const selected = hikes.find((h) => h.id === selectedId)
    return selected ? selected.bounds : unionBounds(hikes.map((h) => h.bounds))
  }, [hikes, selectedId])

  return (
    <LayeredMap center={[2.35, 46.6]} zoom={5} className="size-full" heatmapToggle>
      <MapControls position="bottom-right" showZoom showCompass showLocate showFullscreen />
      <FitBounds bounds={fitTarget} />
      {heatmap && <HeatmapLayer lines={lines} />}
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
            // Under the heatmap, routes stay faintly visible and clickable.
            opacity={heatmap && !highlighted ? 0.2 : dimmed ? 0.35 : 0.85}
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
    </LayeredMap>
  )
}
