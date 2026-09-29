import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Bounds, Hike, Tracks } from './api'
import { useHikeColors } from './colors'
import { HikeList } from './HikeList'
import type { PopupState } from './HikePopup'
import { HikesMap } from './HikesMap'

/** HikesMap with its hover and popup state. */
type Props = {
  hikes: Hike[]
  colorFrom?: Hike[]
  tracks: Tracks | undefined
  /** Whose hikes these are, so hikes they were tagged on can say so. */
  userId: string | undefined
  /** The signed-in user's own map: show a list of the hikes in view and offer explored tiles. */
  list?: boolean
}

export function HikesMapView({ hikes, colorFrom, tracks, userId, list = false }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [view, setView] = useState<Bounds | null>(null)
  const nonce = useRef(0)
  const colors = useHikeColors(hikes, colorFrom)

  // Where a hike picked from the list opens its popup: the start of its track.
  const starts = useMemo(
    () => new Map((tracks?.features ?? []).map((f) => [f.properties.id, f.geometry.coordinates[0]?.[0]])),
    [tracks],
  )

  function openPopup(hikeId: string, longitude: number, latitude: number) {
    setPopup({ hikeId, longitude, latitude, nonce: ++nonce.current })
  }

  function closePopup(closedNonce: number) {
    setPopup((p) => (p?.nonce === closedNonce ? null : p))
  }

  function select(hike: Hike) {
    const [lon, lat] = starts.get(hike.id) ?? [(hike.bounds[0] + hike.bounds[2]) / 2, (hike.bounds[1] + hike.bounds[3]) / 2]
    openPopup(hike.id, lon, lat)
  }

  const onViewChange = useCallback((b: Bounds) => setView(b), [])

  // On your own map, start on your latest walked hike, once: closing it
  // leaves the map on all hikes.
  const autoSelected = useRef(false)
  useEffect(() => {
    if (!list || autoSelected.current || !tracks || hikes.length === 0) return
    autoSelected.current = true
    const latest = latestHike(hikes)
    if (!latest) return
    // The track's middle point sits mid-screen once the map fits the hike,
    // clear of the list in the corner.
    const line = tracks.features.find((f) => f.properties.id === latest.id)?.geometry.coordinates.flat()
    const middle = line?.[Math.floor(line.length / 2)]
    if (middle) openPopup(latest.id, middle[0], middle[1])
    else select(latest)
    // openPopup and select only read the tracks, which this waits for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, tracks, hikes])

  return (
    <>
      <HikesMap
        hikes={hikes}
        colorFrom={colorFrom}
        userId={userId}
        tracks={tracks}
        selectedId={popup?.hikeId ?? null}
        hoveredId={hoveredId}
        popup={popup}
        onRouteClick={openPopup}
        onHover={setHoveredId}
        onPopupClose={closePopup}
        onViewChange={list ? onViewChange : undefined}
        explorable={list}
      />
      {list && hikes.length > 0 && (
        <HikeList
          hikes={hikes}
          colors={colors}
          view={view}
          selectedId={popup?.hikeId ?? null}
          onSelect={select}
          onHover={setHoveredId}
        />
      )}
    </>
  )
}

/** The most recently started walked hike, else the first one there is. */
function latestHike(hikes: Hike[]): Hike | undefined {
  const done = hikes.filter((h) => !h.planned && h.startedAt)
  if (done.length === 0) return hikes[0]
  return done.reduce((a, b) => (b.startedAt! > a.startedAt! ? b : a))
}
