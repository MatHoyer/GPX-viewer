import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { safeStorage } from '@/lib/storage'

import { keepFix, type Fix, type Segments } from './track'

export type GpsError = 'unsupported' | 'denied' | 'unavailable'

export type RecordStatus = 'idle' | 'recording' | 'paused'

/** The latest position reported, kept or not. */
export type Here = { lat: number; lon: number; accuracyM: number }

type RecordState = {
  status: RecordStatus
  segments: Segments
  startedAt: number | null
  here: Here | null
  /** Why there is no position. */
  gpsError: GpsError | null
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  locate: (fix: Fix, accuracyM: number) => void
  setGpsError: (error: GpsError | null) => void
}

/**
 * The hike being recorded. Saved to the browser after every kept fix, so a
 * reload or a crash mid-hike loses nothing.
 */
// shortcut: rewrites the whole track to localStorage per fix; move to IndexedDB if long hikes get slow or hit the ~5 MB quota.
export const useRecord = create<RecordState>()(
  persist(
    (set) => ({
      status: 'idle',
      segments: [],
      startedAt: null,
      here: null,
      gpsError: null,
      start: () => set({ status: 'recording', segments: [[]], startedAt: Date.now() }),
      pause: () => set({ status: 'paused' }),
      resume: () => set((s) => ({ status: 'recording', segments: [...s.segments, []] })),
      reset: () => set({ status: 'idle', segments: [], startedAt: null }),
      locate: (fix, accuracyM) =>
        set((s) => {
          const here = { lat: fix.lat, lon: fix.lon, accuracyM }
          if (s.status !== 'recording') return { here, gpsError: null }
          const segments = s.segments.length > 0 ? s.segments : [[]]
          const current = segments[segments.length - 1]
          if (!keepFix(current[current.length - 1], fix, accuracyM)) return { here, gpsError: null }
          return { here, gpsError: null, segments: [...segments.slice(0, -1), [...current, fix]] }
        }),
      setGpsError: (gpsError) => set({ gpsError }),
    }),
    {
      name: 'recording',
      storage: safeStorage,
      partialize: ({ status, segments, startedAt }) => ({ status, segments, startedAt }),
    },
  ),
)
