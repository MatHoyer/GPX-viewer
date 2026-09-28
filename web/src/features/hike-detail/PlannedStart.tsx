import { Moon, Sun, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { FloatingInput } from '@/components/ui/floating-input'
import { ESTIMATE_NOTE, estimatedDurationS } from '@/features/hikes/estimate'
import { formatDuration, formatTime } from '@/lib/format'

import { plannedFinish } from './sun'
import { fromLocalInput, toLocalInput } from './timezone'

type Props = {
  distanceM: number
  /** Where the route starts, [lon, lat]. */
  start: [number, number]
  /** The route's own time zone; the viewer's when undefined. */
  timeZone?: string
}

/** Today at 8:00 where the route starts. */
function defaultStart(timeZone?: string): string {
  return `${toLocalInput(new Date(), timeZone).slice(0, 10)}T08:00`
}

/** Picks a start time for a planned route and tells whether it ends before dark. */
export function PlannedStart({ distanceM, start: [lon, lat], timeZone }: Props) {
  const [value, setValue] = useState(() => defaultStart(timeZone))
  const startAt = fromLocalInput(value, timeZone)
  const durationS = estimatedDurationS(distanceM)
  const f = startAt && plannedFinish(startAt, durationS, lat, lon)

  return (
    <div className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2.5">
      <FloatingInput
        label="Start at"
        type="datetime-local"
        size="sm"
        className="w-52"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {f && (
        <div className="space-y-0.5 text-sm">
          <p className="tabular-nums">
            Finish ~{formatTime(f.finish, timeZone)}
            <span className="text-muted-foreground" title={ESTIMATE_NOTE}>
              {' '}
              after ~{formatDuration(durationS)}
            </span>
            {f.dusk && !f.alwaysUp && !f.alwaysDown && (
              <span className="text-muted-foreground"> · dusk {formatTime(f.dusk, timeZone)}</span>
            )}
          </p>
          {f.alwaysDown ? (
            <Note icon={Moon} warn>
              Polar night: no daylight that day
            </Note>
          ) : f.alwaysUp ? (
            <Note icon={Sun}>Midnight sun: daylight all day</Note>
          ) : f.afterDusk ? (
            <Note icon={TriangleAlert} warn>
              Finishes after dusk, in the dark
            </Note>
          ) : null}
        </div>
      )}
    </div>
  )
}

function Note({ icon: Icon, warn = false, children }: { icon: LucideIcon; warn?: boolean; children: ReactNode }) {
  return (
    <p
      role={warn ? 'alert' : undefined}
      className={warn ? 'flex items-center gap-1.5 text-amber-600 dark:text-amber-400' : 'text-muted-foreground flex items-center gap-1.5'}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  )
}
