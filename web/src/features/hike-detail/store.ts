import { create } from 'zustand'

import type { Axis } from './profile'

export const replaySpeeds = [10, 30, 60, 120, 300, 600] as const

type ReplayState = {
  /** Number of points in the profile. */
  count: number
  /** Replay head as a fractional point index. */
  pos: number
  /** Point under the cursor on any chart, as a fractional index. */
  hover: number | null
  /** Zoomed section as fractional indices, or null for the whole hike. */
  range: [number, number] | null
  axis: Axis
  playing: boolean
  speed: number
  follow: boolean

  reset: (count: number, axis: Axis) => void
  setPos: (pos: number) => void
  setHover: (hover: number | null) => void
  setRange: (range: [number, number] | null) => void
  setAxis: (axis: Axis) => void
  setPlaying: (playing: boolean) => void
  setSpeed: (speed: number) => void
  setFollow: (follow: boolean) => void
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const useReplay = create<ReplayState>((set, get) => ({
  count: 0,
  pos: 0,
  hover: null,
  range: null,
  axis: 'dist',
  playing: false,
  speed: 120,
  follow: false,

  reset: (count, axis) => set({ count, axis, pos: 0, hover: null, range: null, playing: false }),
  setPos: (pos) => set({ pos: clamp(pos, 0, Math.max(0, get().count - 1)) }),
  setHover: (hover) => set({ hover }),
  setRange: (range) => {
    if (!range) return set({ range: null })
    const last = Math.max(0, get().count - 1)
    const lo = clamp(Math.min(range[0], range[1]), 0, last)
    const hi = clamp(Math.max(range[0], range[1]), 0, last)
    if (hi - lo < 1 || (lo === 0 && hi === last)) return set({ range: null })
    const pos = get().pos
    set({ range: [lo, hi], pos: pos < lo || pos > hi ? lo : pos })
  },
  setAxis: (axis) => set({ axis }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setFollow: (follow) => set({ follow }),
}))

/** Current visible index span: the zoom range or the whole hike. */
export function visibleSpan(s: Pick<ReplayState, 'range' | 'count'>): [number, number] {
  return s.range ?? [0, Math.max(0, s.count - 1)]
}
