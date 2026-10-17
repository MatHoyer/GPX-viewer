import { useEffect } from 'react'

import { useRecord } from './store'

/**
 * Follows the device position while `active`, feeding the recording, and
 * keeps the screen on while recording: browsers stop reporting the position
 * of a page once the screen locks.
 */
export function useGps(active: boolean) {
  const recording = useRecord((s) => s.status === 'recording')

  useEffect(() => {
    if (!active) return
    if (!('geolocation' in navigator)) {
      useRecord.getState().setGpsError('unsupported')
      return
    }
    const id = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) =>
        useRecord
          .getState()
          .locate({ lat: coords.latitude, lon: coords.longitude, ele: coords.altitude, t: timestamp }, coords.accuracy),
      (err) => useRecord.getState().setGpsError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 0 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [active])

  useEffect(() => {
    if (!recording || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false
    const acquire = () =>
      navigator.wakeLock.request('screen').then(
        (l) => (stopped ? void l.release() : (lock = l)),
        () => {}, // Refused, e.g. on low battery: recording goes on, gaps may appear.
      )
    // The lock is dropped whenever the page is hidden; take it again on return.
    const onVisible = () => document.visibilityState === 'visible' && acquire()
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [recording])
}
