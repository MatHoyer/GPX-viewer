import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import type { Hike } from '@/features/hikes/api'
import { hikeColor } from '@/features/hikes/colors'
import { useMe } from '@/features/auth/useAuth'
import { FilterBar } from '@/features/hikes/FilterBar'
import { filterHikes, useHikeFilters } from '@/features/hikes/filters'
import { taggedBy } from '@/features/hikes/owner'
import { useHikes } from '@/features/hikes/useHikes'
import { formatDistance, formatDuration, formatElevation } from '@/lib/format'
import { cn } from '@/lib/utils'

import { addMonths, currentMonth, dayKey, formatMonthParam, monthGrid, parseMonth, type YearMonth } from './month'

type DatedHike = { hike: Hike; color: string; start: Date }

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
// 2024-01-01 is a Monday; the grid starts weeks on Monday.
const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(2024, 0, 1 + i)))

export function CalendarPage() {
  const hikes = useHikes()
  const me = useMe()
  const filters = useHikeFilters((s) => s.filters)
  const [params, setParams] = useSearchParams()
  const month = parseMonth(params.get('month')) ?? currentMonth()
  const today = dayKey(new Date())

  function goTo(next: YearMonth) {
    setParams(
      (p) => {
        p.set('month', formatMonthParam(next))
        return p
      },
      { replace: true },
    )
  }

  // Colors follow the unfiltered list order so a hike has the same color as on the map.
  const { byDay, undated } = useMemo(() => {
    const all = hikes.data ?? []
    // Planned routes have no real date yet; keep them off the calendar.
    const shown = new Set(filterHikes(all, filters, me.data?.id).filter((h) => !h.planned))
    const byDay = new Map<string, DatedHike[]>()
    let undated = 0
    all.forEach((hike, i) => {
      if (!shown.has(hike)) return
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
  }, [hikes.data, filters, me.data?.id])

  const days = monthGrid(month)
  const inMonth = days.filter((d) => d.getMonth() === month.month).flatMap((d) => byDay.get(dayKey(d)) ?? [])
  const monthDistance = inMonth.reduce((s, { hike }) => s + hike.distanceM, 0)
  const monthElevation = inMonth.reduce((s, { hike }) => s + hike.elevationGainM, 0)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold capitalize">
          {monthFormatter.format(new Date(month.year, month.month, 1))}
        </h1>
        <p className="text-muted-foreground hidden text-sm tabular-nums sm:block">
          <MonthSummary count={inMonth.length} distance={monthDistance} elevation={monthElevation} />
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

      {hikes.data && hikes.data.length > 0 && (
        <div className="border-b px-2 py-1.5 sm:px-4">
          <FilterBar hikes={hikes.data} userId={me.data?.id} matched={filterHikes(hikes.data, filters, me.data?.id).length} />
        </div>
      )}

      <div className="grid grid-cols-7 border-b">
        {weekdays.map((d) => (
          <div key={d} className="text-muted-foreground px-2 py-1.5 text-center text-xs font-medium capitalize">
            {d}
          </div>
        ))}
      </div>

      {/* Phones get a compact grid with the month's hikes listed below it; wider screens a full-height grid. */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 sm:h-full sm:auto-rows-fr">
          {days.map((day) => {
            const key = dayKey(day)
            const outside = day.getMonth() !== month.month
            const entries = byDay.get(key) ?? []
            return (
              <div
                key={key}
                className={cn(
                  'relative flex min-h-14 min-w-0 flex-col items-center gap-1 border-r border-b p-1 [&:nth-child(7n)]:border-r-0 sm:min-h-28 sm:items-stretch',
                  outside && 'bg-muted/40',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full text-xs tabular-nums sm:self-end',
                    outside && 'text-muted-foreground',
                    key === today && 'bg-primary text-primary-foreground font-semibold',
                  )}
                >
                  {day.getDate()}
                </span>
                {hikes.isLoading ? (
                  <Skeleton className="h-2 w-6 sm:h-5 sm:w-full" />
                ) : (
                  <>
                    <div className={cn('flex flex-wrap justify-center gap-0.5 sm:hidden', outside && 'opacity-60')}>
                      {entries.map(({ hike, color }) => (
                        <span key={hike.id} className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    <div className="hidden min-w-0 flex-col gap-1 sm:flex">
                      {entries.map((entry) => (
                        <HikeChip key={entry.hike.id} {...entry} muted={outside} />
                      ))}
                    </div>
                  </>
                )}
                {entries.length > 0 && !outside && (
                  <button
                    type="button"
                    className="absolute inset-0 sm:hidden"
                    aria-label={`Show hikes on ${dayFormatter.format(day)}`}
                    onClick={() => document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: 'smooth' })}
                  />
                )}
              </div>
            )
          })}
        </div>

        <MonthAgenda
          byDay={byDay}
          days={days.filter((d) => d.getMonth() === month.month)}
          loading={hikes.isLoading}
          summary={<MonthSummary count={inMonth.length} distance={monthDistance} elevation={monthElevation} />}
        />
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

function MonthSummary({ count, distance, elevation }: { count: number; distance: number; elevation: number }) {
  return (
    <>
      {count} {count === 1 ? 'hike' : 'hikes'} · {formatDistance(distance)} · {formatElevation(elevation)} D+
    </>
  )
}

type AgendaProps = { byDay: Map<string, DatedHike[]>; days: Date[]; loading: boolean; summary: React.ReactNode }

function MonthAgenda({ byDay, days, loading, summary }: AgendaProps) {
  const withHikes = days.filter((d) => byDay.has(dayKey(d)))
  return (
    <section className="sm:hidden">
      {withHikes.length > 0 && <h2 className="text-muted-foreground px-4 pt-4 pb-2 text-sm tabular-nums">{summary}</h2>}
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : withHikes.length === 0 ? (
        <p className="text-muted-foreground p-4 text-sm">No hikes this month.</p>
      ) : (
        <ol className="divide-y border-y">
          {withHikes.map((day) => {
            const key = dayKey(day)
            return (
              <li key={key} id={`day-${key}`} className="flex scroll-mt-2 gap-3 px-4 py-3">
                <div className="w-9 shrink-0 text-center">
                  <p className="text-muted-foreground text-[11px] uppercase">{weekdayFormatter.format(day)}</p>
                  <p className="text-lg leading-tight font-semibold tabular-nums">{day.getDate()}</p>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {byDay.get(key)!.map((entry) => (
                    <AgendaItem key={entry.hike.id} {...entry} />
                  ))}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function AgendaItem({ hike, color }: DatedHike) {
  const owner = taggedBy(hike, useMe().data?.id)
  return (
    <Link
      to={`/hikes/${hike.id}`}
      className="hover:bg-accent active:bg-accent -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors"
    >
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{hike.name}</span>
        <span className="text-muted-foreground block truncate text-xs tabular-nums">
          {hikeDetails(hike).join(' · ')}
          {owner && ` · tagged by ${owner}`}
        </span>
      </span>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </Link>
  )
}

function hikeDetails(hike: Hike): string[] {
  const details = [formatDistance(hike.distanceM), `${formatElevation(hike.elevationGainM)} D+`]
  if (hike.durationS > 0) details.push(formatDuration(hike.durationS))
  return details
}

function HikeChip({ hike, color, muted }: DatedHike & { muted: boolean }) {
  const owner = taggedBy(hike, useMe().data?.id)

  return (
    <Link
      to={`/hikes/${hike.id}`}
      title={`${hike.name}${owner ? ` (tagged by ${owner})` : ''} — ${hikeDetails(hike).join(' · ')}`}
      className={cn(
        'hover:bg-accent flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs transition-colors',
        muted && 'opacity-60',
      )}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{hike.name}</span>
        <span className="text-muted-foreground truncate tabular-nums">{formatDistance(hike.distanceM)}</span>
      </span>
    </Link>
  )
}
