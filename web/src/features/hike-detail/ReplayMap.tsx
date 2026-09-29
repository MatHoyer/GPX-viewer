import type { Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { MapControls, MapMarker, MapRoute, MarkerContent, useMap } from '@/components/ui/map'
import { FitBounds } from '@/features/hikes/FitBounds'
import type { Peak } from '@/features/stats/summits'
import { formatElevation } from '@/lib/format'
import { basemapStyles, DEM_SOURCE_ID, demSource, useMapView } from '@/features/map/basemaps'
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
  const { t } = useTranslation()
  const last = profile.lon.length - 1
  return (
    <>
      <MapMarker longitude={profile.lon[0]} latitude={profile.lat[0]}>
        <MarkerContent>
          <span className="block size-3 rounded-full border-2 border-white bg-emerald-500 shadow" title={t('replay.start')} />
        </MarkerContent>
      </MapMarker>
      <MapMarker longitude={profile.lon[last]} latitude={profile.lat[last]}>
        <MarkerContent>
          <span className="block size-3 rounded-sm border-2 border-white bg-neutral-900 shadow" title={t('replay.finish')} />
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

/** Id of the first track layer, so sun layers slide in under the tracks. */
function firstRouteLayer(map: MapLibreMap) {
  return map.getStyle().layers.find((l) => l.id.startsWith('route-'))?.id
}

function removeLayer(map: MapLibreMap, id: string) {
  // The style may already be gone (basemap swap, unmount).
  if (map.style && map.getLayer(id)) map.removeLayer(id)
}

/**
 * While the replay runs (playing, or paused away from the start), washes the
 * basemap warm near sunset and dark blue at night, as the sun stood at the
 * replay position. With 3D terrain on, whose elevation tiles are then already
 * loaded, the relief is also lit from the sun. Both layers sit under the
 * tracks, so the route and markers keep their colors.
 */
function SunLighting({ profile, startedAt }: { profile: Profile; startedAt: string | null }) {
  const { map, isLoaded, resolvedTheme } = useMap()
  const basemap = useMapView((s) => s.basemap)
  const terrain = useMapView((s) => s.terrain)
  // Only the default street map has a dark variant; it needs a lighter touch.
  const darkMap = resolvedTheme === 'dark' && basemapStyles[basemap] === undefined
  const pos = useReplay((s) => s.pos)
  const replaying = useReplay((s) => s.playing) || pos > 0
  const sun = replaying ? sunAtIndex(profile, startedAt, pos) : null
  // Rounded so replay frames only repaint when the light visibly changes.
  const azimuth = sun && Math.round(sun.azimuth)
  const altitude = sun && Math.round(sun.altitude * 4) / 4
  const lit = sun !== null
  const shaded = lit && terrain

  useEffect(() => {
    if (!map || !isLoaded || !lit) return
    map.addLayer({ id: SUN_TINT_ID, type: 'background', paint: { 'background-opacity': 0 } }, firstRouteLayer(map))
    return () => removeLayer(map, SUN_TINT_ID)
  }, [map, isLoaded, lit])

  useEffect(() => {
    if (!map || !isLoaded || !shaded) return
    // The terrain adds the elevation source; the tint stays above the relief.
    if (!map.getSource(DEM_SOURCE_ID)) map.addSource(DEM_SOURCE_ID, demSource)
    map.addLayer(
      {
        id: SUN_SHADE_ID,
        type: 'hillshade',
        source: DEM_SOURCE_ID,
        paint: { 'hillshade-method': 'combined', 'hillshade-illumination-anchor': 'map' },
      },
      map.getLayer(SUN_TINT_ID) ? SUN_TINT_ID : firstRouteLayer(map),
    )
    return () => removeLayer(map, SUN_SHADE_ID)
  }, [map, isLoaded, shaded])

  useEffect(() => {
    if (!map || !isLoaded || azimuth === null || altitude === null) return
    if (map.getLayer(SUN_TINT_ID)) {
      const tint = sunTint(altitude)
      map.setPaintProperty(SUN_TINT_ID, 'background-color', tint.color)
      map.setPaintProperty(SUN_TINT_ID, 'background-opacity', darkMap ? tint.opacity / 2 : tint.opacity)
    }
    if (map.getLayer(SUN_SHADE_ID)) {
      // Shadows fade out as the sun sinks below the horizon, where only the tint remains.
      const shade = altitude > 0 ? SHADE_EXAGGERATION : Math.max(0, SHADE_EXAGGERATION * (1 + altitude / 6))
      map.setPaintProperty(SUN_SHADE_ID, 'hillshade-illumination-direction', azimuth)
      map.setPaintProperty(SUN_SHADE_ID, 'hillshade-illumination-altitude', Math.max(0, altitude))
      map.setPaintProperty(SUN_SHADE_ID, 'hillshade-exaggeration', shade)
      // White highlights would grey out a dark map.
      map.setPaintProperty(SUN_SHADE_ID, 'hillshade-highlight-color', darkMap ? 'rgba(255, 255, 255, 0.12)' : '#ffffff')
    }
  }, [map, isLoaded, azimuth, altitude, darkMap, lit, shaded])

  return null
}
