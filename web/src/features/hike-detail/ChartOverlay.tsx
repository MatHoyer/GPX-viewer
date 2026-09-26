import { useRef, useState, type PointerEvent } from 'react'

import { CHART } from './layout'
import { indexAt, xAt } from './profile'
import { useReplay } from './store'

type Props = {
  xs: number[]
  domain: [number, number]
  showXAxis: boolean
}

type Drag = { mode: 'seek' } | { mode: 'brush'; start: number }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Transparent layer over a chart's plot area. It turns pointer input into
 * replay-store updates (hover, seek, shift-drag range) and draws the synced
 * head and hover lines, so Recharts never re-renders during interaction.
 */
export function ChartOverlay({ xs, domain, showXAxis }: Props) {
  const pos = useReplay((s) => s.pos)
  const hover = useReplay((s) => s.hover)
  const drag = useRef<Drag | null>(null)
  const [brush, setBrush] = useState<[number, number] | null>(null)

  const width = domain[1] - domain[0] || 1
  const toIndex = (f: number) => indexAt(xs, domain[0] + f * width)
  const toFrac = (i: number) => (xAt(xs, i) - domain[0]) / width

  function frac(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return clamp01((e.clientX - rect.left) / rect.width)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const f = frac(e)
    const s = useReplay.getState()
    if (e.shiftKey) {
      drag.current = { mode: 'brush', start: f }
      setBrush([f, f])
    } else {
      drag.current = { mode: 'seek' }
      s.setPlaying(false)
      s.setPos(toIndex(f))
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const f = frac(e)
    const s = useReplay.getState()
    s.setHover(toIndex(f))
    const d = drag.current
    if (d?.mode === 'seek') s.setPos(toIndex(f))
    if (d?.mode === 'brush') setBrush([d.start, f])
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    drag.current = null
    setBrush(null)
    if (d?.mode !== 'brush') return
    const f = frac(e)
    if (Math.abs(f - d.start) > 0.01) {
      useReplay.getState().setRange([toIndex(Math.min(f, d.start)), toIndex(Math.max(f, d.start))])
    }
  }

  const headFrac = toFrac(pos)
  const hoverFrac = hover === null ? null : toFrac(hover)

  return (
    <div
      className="absolute cursor-crosshair touch-pan-y select-none"
      style={{ left: CHART.yAxisWidth, right: CHART.marginRight, top: CHART.marginTop, bottom: showXAxis ? CHART.xAxisHeight : 0 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => !drag.current && useReplay.getState().setHover(null)}
      onDoubleClick={() => useReplay.getState().setRange(null)}
    >
      {brush && (
        <div
          className="bg-primary/15 border-primary/40 absolute inset-y-0 border-x"
          style={{ left: `${Math.min(...brush) * 100}%`, width: `${Math.abs(brush[1] - brush[0]) * 100}%` }}
        />
      )}
      {hoverFrac !== null && hoverFrac >= 0 && hoverFrac <= 1 && (
        <div className="bg-foreground/40 pointer-events-none absolute inset-y-0 w-px" style={{ left: `${hoverFrac * 100}%` }} />
      )}
      {headFrac >= 0 && headFrac <= 1 && (
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2"
          style={{ left: `${headFrac * 100}%`, backgroundColor: 'var(--replay-head)' }}
        />
      )}
    </div>
  )
}
