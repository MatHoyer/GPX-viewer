import { useEffect, useMemo } from 'react'

import { MapControls, MapMarker, MapRoute, MarkerContent, useMap } from '@/components/ui/map'
import { FitBounds } from '@/features/hikes/FitBounds'
import type { Peak } from '@/features/stats/summits'
import { formatElevation } from '@/lib/format'
import { DEM_SOURCE_ID, demSource } from '@/features/map/basemaps'
import { LayeredMap } from '@/features/map/LayeredMap'

import { boundsBetween, linesBetween, positionAt, type Profile } from './profile'
import { useReplay } from './store'
import { sunAtIndex, sunTint } from './sun'

const TRACK_COLOR = '#2e86ab'
const HEAD_COLOR = 'var(--replay-head)'

type Props = {
  profile: Profile
  peaks?: Peak[]
  /** Start of a walked hike: the map is lit by the sun as it stood at the replay position. */
  startedAt?: string | null
}

export function ReplayMap({ profile, peaks = [], startedAt = null }: Props) {
  const fullLines = useMemo(() => linesBetween(profile, 0, profile.lon.length - 1), [profile])

  return (
    <LayeredMap className="size-full" center={positionAt(profile, 0)} zoom={12}>
      <MapControls position="bottom-right" showZoom showCompass showFullscreen />
      <ZoomToRange profile={profile} />
      <SunLighting profile={profile} startedAt={startedAt} />
      {fullLines.map((line, i) => (
        <MapRoute key={i} id={`track-${i}`} coordinates={line} color={TRACK_COLOR} width={4} opacity={0.35} interactive={false} />
      ))}
      <RangeRoute profile={profile} />
      <TraveledRoute profile={profile} />
      <StartEndMarkers profile={profile} />
      {peaks.map((p) => (
        <MapMarker key={p.id} longitude={p.lon} latitude={p.lat}>
          <MarkerContent>
            <span
              className="block size-0 border-x-[7px] border-b-[12px] border-x-transparent border-b-neutral-800 drop-shadow dark:border-b-white"
              title={p.eleM !== null ? `${p.name} (${formatElevation(p.eleM)})` : p.name}
            />
          </MarkerContent>
        </MapMarker>
      ))}
      <HoverMarker profile={profile} />
      <HeadMarker profile={profile} />
      <FollowCamera profile={profile} />
    </LayeredMap>
  )
}

function ZoomToRange({ profile }: { profile: Profile }) {
  const range = useReplay((s) => s.range)
  const bounds = useMemo(
    () => (range ? boundsBetween(profile, range[0], range[1]) : boundsBetween(profile)),
    [profile, range],
  )
  return <FitBounds bounds={bounds} padding={48} maxZoom={16} />
}

function RangeRoute({ profile }: { profile: Profile }) {
  const range = useReplay((s) => s.range)
  const lines = useMemo(() => (range ? linesBetween(profile, range[0], range[1]) : []), [profile, range])
  return lines.map((line, i) => (
    <MapRoute key={i} id={`range-${i}`} coordinates={line} color={TRACK_COLOR} width={7} opacity={0.45} interactive={false} />
  ))
}

function TraveledRoute({ profile }: { profile: Profile }) {
  const pos = useReplay((s) => s.pos)
  const lines = useMemo(() => linesBetween(profile, 0, pos), [profile, pos])
  return lines.map((line, i) => (
    <MapRoute key={i} id={`traveled-${i}`} coordinates={line} color={TRACK_COLOR} width={4} opacity={1} interactive={false} />
  ))
}

function StartEndMarkers({ profile }: { profile: Profile }) {
  const last = profile.lon.length - 1
  return (
    <>
      <MapMarker longitude={profile.lon[0]} latitude={profile.lat[0]}>
        <MarkerContent>
          <span className="block size-3 rounded-full border-2 border-white bg-emerald-500 shadow" title="Start" />
        </MarkerContent>
      </MapMarker>
      <MapMarker longitude={profile.lon[last]} latitude={profile.lat[last]}>
        <MarkerContent>
          <span className="block size-3 rounded-sm border-2 border-white bg-neutral-900 shadow" title="Finish" />
        </MarkerContent>
      </MapMarker>
    </>
  )
}

function HeadMarker({ profile }: { profile: Profile }) {
  const pos = useReplay((s) => s.pos)
  const [lon, lat] = positionAt(profile, pos)
  return (
    <MapMarker longitude={lon} latitude={lat}>
      <MarkerContent>
        <span className="relative flex size-4">
          <span className="absolute inline-flex size-full animate-ping rounded-full opacity-50" style={{ backgroundColor: HEAD_COLOR }} />
          <span className="relative inline-flex size-4 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: HEAD_COLOR }} />
        </span>
      </MarkerContent>
    </MapMarker>
  )
}

function HoverMarker({ profile }: { profile: Profile }) {
  const hover = useReplay((s) => s.hover)
  if (hover === null) return null
  const [lon, lat] = positionAt(profile, hover)
  return (
    <MapMarker longitude={lon} latitude={lat}>
      <MarkerContent>
        <span className="bg-background/80 block size-3.5 rounded-full border-2 shadow" style={{ borderColor: HEAD_COLOR }} />
      </MarkerContent>
    </MapMarker>
  )
}

function FollowCamera({ profile }: { profile: Profile }) {
  const { map, isLoaded } = useMap()
  const follow = useReplay((s) => s.follow)
  const pos = useReplay((s) => s.pos)

  useEffect(() => {
    if (!map || !isLoaded || !follow) return
    map.setCenter(positionAt(profile, pos))
  }, [map, isLoaded, follow, profile, pos])

  return null
}

const SUN_SHADE_ID = 'sun-hillshade'
const SUN_TINT_ID = 'sun-tint'
const SHADE_EXAGGERATION = 0.25

/**
 * Lights the terrain from where the sun stood at the replay position, and
 * washes the basemap warm near sunset and dark blue at night. Both layers sit
 * under the tracks, so the route and markers keep their colors.
 */
function SunLighting({ profile, startedAt }: { profile: Profile; startedAt: string | null }) {
  const { map, isLoaded } = useMap()
  const pos = useReplay((s) => s.pos)
  const sun = sunAtIndex(profile, startedAt, pos)
  // Rounded so replay frames only repaint when the light visibly changes.
  const azimuth = sun && Math.round(sun.azimuth)
  const altitude = sun && Math.round(sun.altitude * 4) / 4
  const enabled = sun !== null

  useEffect(() => {
    if (!map || !isLoaded || !enabled) return
    if (!map.getSource(DEM_SOURCE_ID)) map.addSource(DEM_SOURCE_ID, demSource)
    const before = map.getStyle().layers.find((l) => l.id.startsWith('route-'))?.id
    map.addLayer(
      {
        id: SUN_SHADE_ID,
        type: 'hillshade',
        source: DEM_SOURCE_ID,
        paint: { 'hillshade-method': 'combined', 'hillshade-illumination-anchor': 'map' },
      },
      before,
    )
    map.addLayer({ id: SUN_TINT_ID, type: 'background', paint: { 'background-opacity': 0 } }, before)
    return () => {
      // The style may already be gone (basemap swap, unmount).
      for (const id of [SUN_TINT_ID, SUN_SHADE_ID]) if (map.style && map.getLayer(id)) map.removeLayer(id)
    }
  }, [map, isLoaded, enabled])

  useEffect(() => {
    if (!map || !isLoaded || azimuth === null || altitude === null || !map.getLayer(SUN_SHADE_ID)) return
    // Shadows fade out as the sun sinks below the horizon, where only the tint remains.
    const shade = altitude > 0 ? SHADE_EXAGGERATION : Math.max(0, SHADE_EXAGGERATION * (1 + altitude / 6))
    map.setPaintProperty(SUN_SHADE_ID, 'hillshade-illumination-direction', azimuth)
    map.setPaintProperty(SUN_SHADE_ID, 'hillshade-illumination-altitude', Math.max(0, altitude))
    map.setPaintProperty(SUN_SHADE_ID, 'hillshade-exaggeration', shade)
    const tint = sunTint(altitude)
    map.setPaintProperty(SUN_TINT_ID, 'background-color', tint.color)
    map.setPaintProperty(SUN_TINT_ID, 'background-opacity', tint.opacity)
  }, [map, isLoaded, azimuth, altitude])

  return null
}
