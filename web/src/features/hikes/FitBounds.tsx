import { useEffect } from 'react'

import { useMap } from '@/components/ui/map'

import type { Bounds } from './api'

type Props = {
  bounds: Bounds | null
  padding?: number
  maxZoom?: number
}

/** Fits the parent map to `bounds` whenever the bounds values change. */
export function FitBounds({ bounds, padding = 64, maxZoom = 15 }: Props) {
  const { map, isLoaded } = useMap()
  const [minLon, minLat, maxLon, maxLat] = bounds ?? []

  useEffect(() => {
    if (!map || !isLoaded || minLon === undefined) return
    map.fitBounds([minLon, minLat, maxLon, maxLat] as Bounds, { padding, maxZoom, duration: 800 })
  }, [map, isLoaded, minLon, minLat, maxLon, maxLat, padding, maxZoom])

  return null
}
