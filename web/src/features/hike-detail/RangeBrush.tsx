import { useMemo, useRef, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { indexAt, xAt, type Series } from './profile'
import { useReplay, visibleSpan } from './store'

type Props = {
  xs: number[]
  /** Series drawn as the overview silhouette (elevation when available). */
  values: Series | undefined
}

type Drag =
  | { mode: 'left' | 'right' }
  | { mode: 'move'; grab: number; width: number }
  | { mode: 'new'; start: number }

const HEIGHT = 44
const HANDLE_HIT = 10 // px

/** Overview strip of the whole hike with a draggable zoom window. */
export function RangeBrush({ xs, values }: Props) {
  const { t } = useTranslation()
  const range = useReplay((s) => s.range)
  const count = useReplay((s) => s.count)
  const pos = useReplay((s) => s.pos)
  const drag = useRef<Drag | null>(null)

  const x0 = xs[0] ?? 0
  const width = (xs[xs.length - 1] ?? 1) - x0 || 1
  const toFrac = (i: number) => (xAt(xs, i) - x0) / width
  const toIndex = (f: number) => indexAt(xs, x0 + Math.min(1, Math.max(0, f)) * width)

  const path = useMemo(() => silhouette(xs, values), [xs, values])
  const [lo, hi] = visibleSpan({ range, count })
  const left = toFrac(lo)
  const right = toFrac(hi)

  function frac(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { f: (e.clientX - rect.left) / rect.width, px: e.clientX - rect.left, w: rect.width }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { f, px, w } = frac(e)
    if (range && Math.abs(px - left * w) <= HANDLE_HIT) drag.current = { mode: 'left' }
    else if (range && Math.abs(px - right * w) <= HANDLE_HIT) drag.current = { mode: 'right' }
    else if (range && f > left && f < right) drag.current = { mode: 'move', grab: f - left, width: right - left }
    else drag.current = { mode: 'new', start: f }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    const { f } = frac(e)
    const setRange = useReplay.getState().setRange
    switch (d.mode) {
      case 'left':
        setRange([toIndex(Math.min(f, right - 0.01)), hi])
        break
      case 'right':
        setRange([lo, toIndex(Math.max(f, left + 0.01))])
        break
      case 'move': {
        const start = Math.min(1 - d.width, Math.max(0, f - d.grab))
        setRange([toIndex(start), toIndex(start + d.width)])
        break
      }
      case 'new':
        if (Math.abs(f - d.start) > 0.005) setRange([toIndex(Math.min(f, d.start)), toIndex(Math.max(f, d.start))])
        break
    }
  }

  function onPointerUp() {
    drag.current = null
  }

  return (
    <div className="space-y-1">
      <div
        className="bg-muted/40 relative cursor-ew-resize touch-pan-y overflow-hidden rounded-md border select-none"
        style={{ height: HEIGHT }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => useReplay.getState().setRange(null)}
        role="slider"
        aria-label={t('charts.zoomRange')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(left * 100)}
      >
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <path d={path} fill="var(--chart-ele)" fillOpacity={0.35} stroke="var(--chart-ele)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {range && (
          <>
            <div className="bg-background/70 absolute inset-y-0 left-0" style={{ width: `${left * 100}%` }} />
            <div className="bg-background/70 absolute inset-y-0 right-0" style={{ width: `${(1 - right) * 100}%` }} />
            <div
              className="border-primary absolute inset-y-0 border-x-2"
              style={{ left: `${left * 100}%`, width: `${(right - left) * 100}%` }}
            >
              <span className="bg-primary absolute top-1/2 -left-[5px] h-4 w-2 -translate-y-1/2 rounded-sm" />
              <span className="bg-primary absolute top-1/2 -right-[5px] h-4 w-2 -translate-y-1/2 rounded-sm" />
            </div>
          </>
        )}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2"
          style={{ left: `${toFrac(pos) * 100}%`, backgroundColor: 'var(--replay-head)' }}
        />
      </div>
      <p className="text-muted-foreground text-[11px]">
        {t('charts.brushHint')}
      </p>
    </div>
  )
}

/** SVG path (viewBox 1000×100) of a series against x, as a filled silhouette. */
function silhouette(xs: number[], values: Series | undefined): string {
  const n = xs.length
  if (n < 2) return ''
  const x0 = xs[0]
  const w = xs[n - 1] - x0 || 1
  let min = Infinity
  let max = -Infinity
  for (const v of values ?? []) {
    if (v !== null) {
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
  }
  const h = max - min || 1
  // Aim for ~1 point per horizontal unit.
  const step = Math.max(1, Math.floor(n / 1000))
  let d = `M0 100`
  for (let i = 0; i < n; i += step) {
    const v = values?.[i]
    const y = v == null || !isFinite(min) ? 70 : 92 - ((v - min) / h) * 80
    d += ` L${(((xs[i] - x0) / w) * 1000).toFixed(1)} ${y.toFixed(1)}`
  }
  return `${d} L1000 100 Z`
}
