import { useEffect, useRef } from 'react'

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

  // A style swap (theme or background change) reloads the map; don't refit then.
  const fitted = useRef<string | null>(null)

  useEffect(() => {
    if (!map || !isLoaded || minLon === undefined) return
    const key = [minLon, minLat, maxLon, maxLat, padding, maxZoom].join()
    if (fitted.current === key) return
    fitted.current = key
    // Keep the current tilt so 3D terrain stays in 3D.
    map.fitBounds([minLon, minLat, maxLon, maxLat] as Bounds, { padding, maxZoom, duration: 800, pitch: map.getPitch() })
  }, [map, isLoaded, minLon, minLat, maxLon, maxLat, padding, maxZoom])

  return null
}
