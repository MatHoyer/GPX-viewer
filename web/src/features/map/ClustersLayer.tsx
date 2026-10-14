import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import { useEffect } from 'react'

import { useMap } from '@/components/ui/map'

const SOURCE_ID = 'hikes-clusters'
const CIRCLE_ID = 'hikes-clusters-circle'
const COUNT_ID = 'hikes-clusters-count'
// Past this zoom routes are big enough to read, so the dots give way to them.
const MAX_ZOOM = 9
// Small radius: nearby hikes merge, a whole country does not.
const RADIUS_PX = 30
const COLOR = '#2e86ab'

type Props = {
  /** One point per hike, its id in properties. */
  points: GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }>
  onPointClick: (id: string, longitude: number, latitude: number) => void
}

/** Zoomed out, hikes as dots showing how many sit there. A click zooms into a group or opens a single hike. */
export function ClustersLayer({ points, onPointClick }: Props) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return
    const source = map.getSource<GeoJSONSource>(SOURCE_ID)
    if (source) {
      source.setData(points)
      return
    }
    map.addSource(SOURCE_ID, { type: 'geojson', data: points, cluster: true, clusterRadius: RADIUS_PX, clusterMaxZoom: MAX_ZOOM - 1 })
    map.addLayer({
      id: CIRCLE_ID,
      type: 'circle',
      source: SOURCE_ID,
      maxzoom: MAX_ZOOM,
      paint: {
        'circle-color': COLOR,
        'circle-radius': ['step', ['coalesce', ['get', 'point_count'], 1], 10, 10, 14, 50, 18],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.9,
      },
    })
    map.addLayer({
      id: COUNT_ID,
      type: 'symbol',
      source: SOURCE_ID,
      maxzoom: MAX_ZOOM,
      layout: {
        'text-field': ['to-string', ['coalesce', ['get', 'point_count'], 1]],
        'text-font': ['Open Sans Bold'],
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#fff' },
    })
  }, [map, isLoaded, points])

  // Routes mount after the dots (tracks load later); keep the dots on top.
  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer(COUNT_ID) || map.getLayersOrder().at(-1) === COUNT_ID) return
    map.moveLayer(CIRCLE_ID)
    map.moveLayer(COUNT_ID)
  })

  useEffect(() => {
    if (!map || !isLoaded) return
    const click = async (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (!f || f.geometry.type !== 'Point') return
      const [lon, lat] = f.geometry.coordinates
      const clusterId = f.properties.cluster_id as number | undefined
      if (clusterId === undefined) {
        onPointClick(f.properties.id as string, lon, lat)
        return
      }
      const zoom = await map.getSource<GeoJSONSource>(SOURCE_ID)?.getClusterExpansionZoom(clusterId)
      if (zoom !== undefined) map.easeTo({ center: [lon, lat], zoom })
    }
    const enter = () => (map.getCanvas().style.cursor = 'pointer')
    const leave = () => (map.getCanvas().style.cursor = '')
    map.on('click', CIRCLE_ID, click)
    map.on('mouseenter', CIRCLE_ID, enter)
    map.on('mouseleave', CIRCLE_ID, leave)
    return () => {
      map.off('click', CIRCLE_ID, click)
      map.off('mouseenter', CIRCLE_ID, enter)
      map.off('mouseleave', CIRCLE_ID, leave)
    }
  }, [map, isLoaded, onPointClick])

  // Remove on unmount; a style swap already dropped them otherwise.
  useEffect(() => {
    if (!map) return
    return () => {
      if (!map.getStyle()) return
      for (const id of [COUNT_ID, CIRCLE_ID]) if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  return null
}
