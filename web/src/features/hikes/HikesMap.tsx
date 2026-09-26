import { useEffect, useMemo } from 'react'

import { Map, MapControls, MapRoute, useMap } from '@/components/ui/map'

import type { Bounds, Hike, Tracks } from './api'
import { hikeColor } from './colors'

type Props = {
  hikes: Hike[]
  tracks: Tracks | undefined
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}

export function HikesMap({ hikes, tracks, selectedId, hoveredId, onSelect, onHover }: Props) {
  const colorById = useMemo(() => new globalThis.Map(hikes.map((h, i) => [h.id, hikeColor(i)])), [hikes])

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
            onClick={() => onSelect(id === selectedId ? null : id)}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
          />
        ))
      })}
    </Map>
  )
}

function FitBounds({ bounds }: { bounds: Bounds | null }) {
  const { map, isLoaded } = useMap()
  const [minLon, minLat, maxLon, maxLat] = bounds ?? []

  useEffect(() => {
    if (!map || !isLoaded || minLon === undefined) return
    map.fitBounds([minLon, minLat, maxLon, maxLat] as Bounds, { padding: 64, maxZoom: 15, duration: 800 })
  }, [map, isLoaded, minLon, minLat, maxLon, maxLat])

  return null
}

function unionBounds(all: Bounds[]): Bounds | null {
  if (all.length === 0) return null
  return all.reduce<Bounds>(
    (acc, b) => [Math.min(acc[0], b[0]), Math.min(acc[1], b[1]), Math.max(acc[2], b[2]), Math.max(acc[3], b[3])],
    [...all[0]],
  )
}
