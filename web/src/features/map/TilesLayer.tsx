import type { GeoJSONSource } from 'maplibre-gl'
import { useEffect, useMemo } from 'react'

import { useMap } from '@/components/ui/map'

import { tileRing, type Square } from './tiles'

const SOURCE_ID = 'explored-tiles'
const FILL_ID = 'explored-tiles-fill'
const LINE_ID = 'explored-tiles-line'
const SQUARE_ID = 'explored-tiles-square'

type Props = {
  zoom: number
  /** Explored tiles as "x,y" keys. */
  explored: Set<string>
  square: Square | null
}

/** Explored map tiles as a tinted grid, with the largest full square outlined. Sits below the routes. */
export function TilesLayer({ zoom, explored, square }: Props) {
  const { map, isLoaded } = useMap()
  const data = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon, { square: boolean }>>(() => {
    const features: GeoJSON.Feature<GeoJSON.Polygon, { square: boolean }>[] = [...explored].map((k) => {
      const [x, y] = k.split(',').map(Number)
      return { type: 'Feature', properties: { square: false }, geometry: { type: 'Polygon', coordinates: [tileRing(x, y, zoom)] } }
    })
    if (square) {
      features.push({
        type: 'Feature',
        properties: { square: true },
        geometry: { type: 'Polygon', coordinates: [tileRing(square.x, square.y, zoom, square.size)] },
      })
    }
    return { type: 'FeatureCollection', features }
  }, [explored, square, zoom])

  useEffect(() => {
    if (!map || !isLoaded) return
    const source = map.getSource<GeoJSONSource>(SOURCE_ID)
    if (source) {
      source.setData(data)
      return
    }
    map.addSource(SOURCE_ID, { type: 'geojson', data })
    const beforeId = map.getStyle().layers.find((l) => l.id.startsWith('hike-'))?.id
    map.addLayer(
      {
        id: FILL_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['!', ['get', 'square']],
        paint: { 'fill-color': '#2e86ab', 'fill-opacity': 0.18 },
      },
      beforeId,
    )
    map.addLayer(
      {
        id: LINE_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['!', ['get', 'square']],
        paint: { 'line-color': '#2e86ab', 'line-opacity': 0.45, 'line-width': 0.75 },
      },
      beforeId,
    )
    map.addLayer(
      {
        id: SQUARE_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['get', 'square'],
        paint: { 'line-color': '#1b4f66', 'line-width': 2.5 },
      },
      beforeId,
    )
  }, [map, isLoaded, data])

  useEffect(() => {
    if (!map) return
    return () => {
      if (!map.getStyle()) return
      for (const id of [SQUARE_ID, LINE_ID, FILL_ID]) if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  return null
}
