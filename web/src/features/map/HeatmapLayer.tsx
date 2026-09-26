import type { GeoJSONSource } from 'maplibre-gl'
import { useEffect, useMemo } from 'react'

import { useMap } from '@/components/ui/map'

import { resamplePoints } from './resample'

const SOURCE_ID = 'hikes-heat'
const LAYER_ID = 'hikes-heat'
const SPACING_M = 25

type Props = {
  /** Lines as [lon, lat] coordinates. */
  lines: [number, number][][]
}

/**
 * Density of every line on the map. Lines are resampled at a fixed spacing so a
 * track logged every second weighs no more than one logged every minute.
 * Sits below the hike routes and is re-added after each background swap.
 */
export function HeatmapLayer({ lines }: Props) {
  const { map, isLoaded } = useMap()
  const data = useMemo<GeoJSON.FeatureCollection<GeoJSON.MultiPoint>>(
    () => ({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: resamplePoints(lines, SPACING_M) } }],
    }),
    [lines],
  )

  useEffect(() => {
    if (!map || !isLoaded) return
    const source = map.getSource<GeoJSONSource>(SOURCE_ID)
    if (source) {
      source.setData(data)
      return
    }
    map.addSource(SOURCE_ID, { type: 'geojson', data })
    const firstRoute = map.getStyle().layers.find((l) => l.id.startsWith('hike-'))?.id
    map.addLayer(
      {
        id: LAYER_ID,
        type: 'heatmap',
        source: SOURCE_ID,
        paint: {
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 8, 16, 20],
          // Points are 25 m apart, so zoomed out many overlap on each pixel. Scale
          // intensity with the on-screen spacing so one pass reads light and only
          // repeated passes turn dark, at any zoom.
          'heatmap-intensity': ['interpolate', ['exponential', 1.7], ['zoom'], 4, 0.002, 16, 0.4],
          // Sequential orange-to-dark-red ramp, transparent where there is nothing.
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(254,232,200,0)',
            0.15,
            'rgba(253,212,158,0.7)',
            0.4,
            '#fc8d59',
            0.7,
            '#d7301f',
            1,
            '#7f0000',
          ],
          'heatmap-opacity': 0.85,
        },
      },
      firstRoute,
    )
  }, [map, isLoaded, data])

  // Remove on unmount; a style swap already dropped them otherwise.
  useEffect(() => {
    if (!map) return
    return () => {
      if (!map.getStyle()) return
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  return null
}
