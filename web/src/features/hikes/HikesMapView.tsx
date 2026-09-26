import { useCallback, useMemo, useRef, useState } from 'react'

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
  /** Show a list of the hikes in view next to the map. */
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
