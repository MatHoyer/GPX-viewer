import { Moon, Sunrise, Sunset } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { CHART } from './layout'
import { indexAt, xAt } from './profile'
import { useReplay } from './store'
import type { LightBand } from './sun'

type Props = {
  xs: number[]
  domain: [number, number]
  showXAxis: boolean
  /** Stretches walked in twilight or at night, shaded under the lines. */
  bands?: LightBand[]
  /** Mark bands with a twilight or night icon; one chart is enough. */
  bandIcons?: boolean
}

type Drag = { mode: 'seek' } | { mode: 'brush'; start: number }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Transparent layer over a chart's plot area. It turns pointer input into
 * replay-store updates (hover, seek, shift-drag range) and draws the synced
 * head and hover lines, so Recharts never re-renders during interaction.
 */
export function ChartOverlay({ xs, domain, showXAxis, bands = [], bandIcons = false }: Props) {
  const { t } = useTranslation()
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
      {bands.map((b) => {
        const from = clamp01(toFrac(b.from))
        const to = clamp01(toFrac(b.to))
        if (to <= from) return null
        const night = b.light === 'night'
        const Icon = night ? Moon : b.rising ? Sunrise : Sunset
        return (
          <div
            key={b.from}
            className={cn('pointer-events-none absolute inset-y-0 flex justify-center', night ? 'bg-foreground/15' : 'bg-foreground/[0.07]')}
            style={{ left: `${from * 100}%`, width: `${(to - from) * 100}%` }}
          >
            {/* Too narrow a band would clip its icon. */}
            {bandIcons && to - from > 0.04 && (
              <Icon className="text-muted-foreground mt-1 size-3.5" role="img" aria-label={night ? t('light.night') : b.rising ? t('light.dawn') : t('light.dusk')} />
            )}
          </div>
        )
      })}
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
