import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import type { Hike } from '@/features/hikes/api'
import { hikeColor } from '@/features/hikes/colors'
import { useMe } from '@/features/auth/useAuth'
import { taggedBy } from '@/features/hikes/owner'
import { useHikes } from '@/features/hikes/useHikes'
import { formatDistance, formatDuration, formatElevation } from '@/lib/format'
import { cn } from '@/lib/utils'

import { addMonths, currentMonth, dayKey, formatMonthParam, monthGrid, parseMonth, type YearMonth } from './month'

type DatedHike = { hike: Hike; color: string; start: Date }

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
// 2024-01-01 is a Monday; the grid starts weeks on Monday.
const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(2024, 0, 1 + i)))

export function CalendarPage() {
  const hikes = useHikes()
  const [params, setParams] = useSearchParams()
  const month = parseMonth(params.get('month')) ?? currentMonth()
  const today = dayKey(new Date())

  function goTo(next: YearMonth) {
    setParams({ month: formatMonthParam(next) }, { replace: true })
  }

  // Colors follow the list order so a hike has the same color as on the map.
  const { byDay, undated } = useMemo(() => {
    const byDay = new Map<string, DatedHike[]>()
    let undated = 0
    ;(hikes.data ?? []).forEach((hike, i) => {
      if (!hike.startedAt) {
        undated++
        return
      }
      const start = new Date(hike.startedAt)
      const key = dayKey(start)
      byDay.set(key, [...(byDay.get(key) ?? []), { hike, color: hikeColor(i), start }])
    })
    for (const list of byDay.values()) list.sort((a, b) => a.start.getTime() - b.start.getTime())
    return { byDay, undated }
  }, [hikes.data])

  const days = monthGrid(month)
  const inMonth = days.filter((d) => d.getMonth() === month.month).flatMap((d) => byDay.get(dayKey(d)) ?? [])
  const monthDistance = inMonth.reduce((s, { hike }) => s + hike.distanceM, 0)
  const monthElevation = inMonth.reduce((s, { hike }) => s + hike.elevationGainM, 0)

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold capitalize">
          {monthFormatter.format(new Date(month.year, month.month, 1))}
        </h1>
        <p className="text-muted-foreground hidden text-sm tabular-nums md:block">
          {inMonth.length} {inMonth.length === 1 ? 'hike' : 'hikes'} · {formatDistance(monthDistance)} ·{' '}
          {formatElevation(monthElevation)} D+
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => goTo(currentMonth())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => goTo(addMonths(month, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => goTo(addMonths(month, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-7 border-b">
        {weekdays.map((d) => (
          <div key={d} className="text-muted-foreground px-2 py-1.5 text-center text-xs font-medium capitalize">
            {d}
          </div>
        ))}
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
        {days.map((day) => {
          const key = dayKey(day)
          const outside = day.getMonth() !== month.month
          const entries = byDay.get(key) ?? []
          return (
            <div
              key={key}
              className={cn(
                'flex min-h-20 min-w-0 flex-col gap-1 border-r border-b p-1 [&:nth-child(7n)]:border-r-0 sm:min-h-28',
                outside && 'bg-muted/40',
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center self-end rounded-full text-xs tabular-nums',
                  outside && 'text-muted-foreground',
                  key === today && 'bg-primary text-primary-foreground font-semibold',
                )}
              >
                {day.getDate()}
              </span>
              {hikes.isLoading ? (
                <Skeleton className="h-5 w-full" />
              ) : (
                entries.map((entry) => <HikeChip key={entry.hike.id} {...entry} muted={outside} />)
              )}
            </div>
          )
        })}
      </div>

      {undated > 0 && (
        <p className="text-muted-foreground border-t px-4 py-2 text-xs">
          {undated} {undated === 1 ? 'hike has' : 'hikes have'} no recorded date and {undated === 1 ? 'is' : 'are'} not
          shown.
        </p>
      )}
    </div>
  )
}

function HikeChip({ hike, color, muted }: DatedHike & { muted: boolean }) {
  const owner = taggedBy(hike, useMe().data?.id)
  const details = [formatDistance(hike.distanceM), `${formatElevation(hike.elevationGainM)} D+`]
  if (hike.durationS > 0) details.push(formatDuration(hike.durationS))

  return (
    <Link
      to={`/hikes/${hike.id}`}
      title={`${hike.name}${owner ? ` (tagged by ${owner})` : ''} — ${details.join(' · ')}`}
      className={cn(
        'hover:bg-accent flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs transition-colors',
        muted && 'opacity-60',
      )}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="hidden min-w-0 flex-col sm:flex">
        <span className="truncate font-medium">{hike.name}</span>
        <span className="text-muted-foreground truncate tabular-nums">{formatDistance(hike.distanceM)}</span>
      </span>
    </Link>
  )
}
