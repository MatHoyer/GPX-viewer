import { ChevronDown, List } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { formatDate, formatDistance, formatElevation } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { Bounds, Hike } from './api'
import { intersects } from './bounds'

type Props = {
  hikes: Hike[]
  colors: Map<string, string>
  /** Visible map area; null until the map reports it. */
  view: Bounds | null
  selectedId: string | null
  onSelect: (hike: Hike) => void
  onHover: (id: string | null) => void
}

/** Floating list of the hikes on the map, by default only those in view. */
export function HikeList({ hikes, colors, view, selectedId, onSelect, onHover }: Props) {
  // Open by default where there is room for it next to the map.
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [inViewOnly, setInViewOnly] = useState(true)
  const inView = view ? hikes.filter((h) => intersects(h.bounds, view)) : hikes
  const shown = inViewOnly ? inView : hikes

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="bg-background absolute bottom-2 left-2 z-10 shadow-sm" onClick={() => setOpen(true)}>
        <List />
        {inView.length} in view
      </Button>
    )
  }

  return (
    <section
      aria-label="Hikes"
      className="bg-background/95 absolute right-14 bottom-2 left-2 z-10 flex max-h-[45%] flex-col rounded-lg border shadow-sm backdrop-blur sm:right-auto sm:w-72"
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="flex-1 text-sm font-medium tabular-nums">
          {inViewOnly ? `${inView.length} in view` : `${hikes.length} hikes`}
        </h2>
        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={inViewOnly} onChange={(e) => setInViewOnly(e.target.checked)} className="accent-primary" />
          Only in view
        </label>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Hide list">
          <ChevronDown />
        </Button>
      </header>
      {shown.length === 0 ? (
        <p className="text-muted-foreground px-3 py-4 text-center text-sm">No hikes here. Zoom out or move the map.</p>
      ) : (
        <ul className="overflow-y-auto py-1" onMouseLeave={() => onHover(null)}>
          {shown.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => onSelect(h)}
                onMouseEnter={() => onHover(h.id)}
                onFocus={() => onHover(h.id)}
                className={cn(
                  'hover:bg-muted focus-visible:bg-muted flex w-full items-start gap-2 px-3 py-1.5 text-left outline-none',
                  h.id === selectedId && 'bg-muted',
                )}
              >
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(h.id) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.name}</span>
                  <span className="text-muted-foreground block text-xs tabular-nums">
                    {[formatDate(h.startedAt), formatDistance(h.distanceM), `${formatElevation(h.elevationGainM)} D+`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
