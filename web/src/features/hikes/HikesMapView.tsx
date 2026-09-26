import { useRef, useState } from 'react'

import type { Hike, Tracks } from './api'
import type { PopupState } from './HikePopup'
import { HikesMap } from './HikesMap'

/** HikesMap with its hover and popup state. */
type Props = {
  hikes: Hike[]
  colorFrom?: Hike[]
  tracks: Tracks | undefined
  /** Whose hikes these are, so hikes they were tagged on can say so. */
  userId: string | undefined
}

export function HikesMapView({ hikes, colorFrom, tracks, userId }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const nonce = useRef(0)

  function openPopup(hikeId: string, longitude: number, latitude: number) {
    setPopup({ hikeId, longitude, latitude, nonce: ++nonce.current })
  }

  function closePopup(closedNonce: number) {
    setPopup((p) => (p?.nonce === closedNonce ? null : p))
  }

  return (
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
    />
  )
}
