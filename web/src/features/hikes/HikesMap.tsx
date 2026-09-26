import { useEffect, useMemo } from 'react'

import { MapControls, MapRoute, useMap } from '@/components/ui/map'
import { useMapView } from '@/features/map/basemaps'
import { HeatmapLayer } from '@/features/map/HeatmapLayer'
import { exploredTiles, maxSquare } from '@/features/map/tiles'
import { TilesLayer } from '@/features/map/TilesLayer'
import { LayeredMap } from '@/features/map/LayeredMap'

import type { Bounds, Hike, Tracks } from './api'
import { hikeColor, useHikeColors } from './colors'
import { unionBounds } from './bounds'
import { FitBounds } from './FitBounds'
import { useTiles } from './useHikes'
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
  /** Called with the visible [minLon, minLat, maxLon, maxLat] whenever the map stops moving. */
  onViewChange?: (bounds: Bounds) => void
  /** These are the signed-in user's own hikes, so their explored tiles can be shown. */
  explorable?: boolean
}

export function HikesMap({ hikes, colorFrom, userId, tracks, selectedId, hoveredId, popup, onRouteClick, onHover, onPopupClose, onViewChange, explorable = false }: Props) {
  const colorById = useHikeColors(hikes, colorFrom)
  const popupHike = popup ? hikes.find((h) => h.id === popup.hikeId) : undefined
  const heatmap = useMapView((s) => s.heatmap)
  const showTiles = useMapView((s) => s.tiles) && explorable
  const tiles = useTiles(showTiles)
  const explored = useMemo(() => exploredTiles(tiles.data, hikes.map((h) => h.id)), [tiles.data, hikes])
  const square = useMemo(() => maxSquare(explored), [explored])
  const lines = useMemo(
    () => (tracks?.features ?? []).flatMap((f) => f.geometry.coordinates as [number, number][][]),
    [tracks],
  )

  const fitTarget = useMemo(() => {
    const selected = hikes.find((h) => h.id === selectedId)
    return selected ? selected.bounds : unionBounds(hikes.map((h) => h.bounds))
  }, [hikes, selectedId])

  return (
    <LayeredMap center={[2.35, 46.6]} zoom={5} className="size-full" heatmapToggle tilesToggle={explorable}>
      <MapControls position="bottom-right" showZoom showCompass showLocate showFullscreen />
      <FitBounds bounds={fitTarget} />
      {onViewChange && <ViewWatcher onChange={onViewChange} />}
      {heatmap && <HeatmapLayer lines={lines} />}
      {showTiles && tiles.data && <TilesLayer zoom={tiles.data.zoom} explored={explored} square={square} />}
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

function ViewWatcher({ onChange }: { onChange: (bounds: Bounds) => void }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded) return
    const report = () => onChange(map.getBounds().toArray().flat() as Bounds)
    report()
    map.on('moveend', report)
    return () => {
      map.off('moveend', report)
    }
  }, [map, isLoaded, onChange])
  return null
}
