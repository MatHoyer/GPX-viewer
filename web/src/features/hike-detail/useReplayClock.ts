import { useEffect, useMemo } from 'react'

import { fillMonotonic, indexAt, xAt, type Profile } from './profile'
import { useReplay, visibleSpan } from './store'

/** Virtual walking speed used to replay tracks without timestamps. */
const VIRTUAL_SPEED_MS = 4 / 3.6

/**
 * Drives the replay head while playing. The clock runs on elapsed time when
 * the track has timestamps, otherwise on distance at a virtual walking pace.
 */
export function useReplayClock(profile: Profile | undefined) {
  const playing = useReplay((s) => s.playing)

  const clock = useMemo(() => {
    if (!profile) return null
    if (profile.has.time && profile.t) return { xs: fillMonotonic(profile.t), unitsPerSecond: 1 }
    return { xs: profile.dist, unitsPerSecond: VIRTUAL_SPEED_MS }
  }, [profile])

  useEffect(() => {
    if (!playing || !clock) return
    const store = useReplay.getState()
    const [lo, hi] = visibleSpan(store)
    // Restart from the beginning of the visible span when already at its end.
    if (store.pos >= hi - 1e-6) store.setPos(lo)

    let x = xAt(clock.xs, useReplay.getState().pos)
    let last = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const s = useReplay.getState()
      if (!s.playing) return
      const [, end] = visibleSpan(s)
      // Resync when the head was moved by the user (seek) since the last frame.
      const expected = indexAt(clock.xs, x)
      if (Math.abs(expected - s.pos) > 0.5) x = xAt(clock.xs, s.pos)

      x += ((now - last) / 1000) * s.speed * clock.unitsPerSecond
      last = now
      const next = Math.min(indexAt(clock.xs, x), end)
      s.setPos(next)
      if (next >= end) {
        s.setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [playing, clock])
}
