import { Trophy } from 'lucide-react'
import { Link } from 'react-router'

import type { Hike } from '@/features/hikes/api'
import { useHikes } from '@/features/hikes/useHikes'
import { formatDate, formatDistance, formatDuration, formatPace } from '@/lib/format'
import { cn } from '@/lib/utils'

import { useSimilarHikes } from './api'

/** Moving time when recorded, else elapsed; 0 when the hike has no times. */
const timeOf = (h: Hike) => h.movingS ?? h.durationS

/** The viewer's times on every hike along the same route as `hike`, fastest marked. */
export function SameRoute({ hike }: { hike: Hike }) {
  const similar = useSimilarHikes(hike.id)
  const mine = useHikes()
  if (!similar.data || similar.data.length === 0) return null

  // Include this hike when it is one of the viewer's own.
  const own = !hike.planned && (mine.data?.some((h) => h.id === hike.id) ?? false)
  const rows = [...(own ? [hike] : []), ...similar.data].sort(
    (a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''),
  )
  const timed = rows.filter((h) => timeOf(h) > 0)
  // Rows are newest first; on a tie the earlier hike keeps the best time, like records.
  const fastest = timed.length > 1 ? timed.reduce((a, b) => (timeOf(b) <= timeOf(a) ? b : a)) : null

  return (
    <section className="bg-card space-y-2 rounded-xl border p-4">
      <h2 className="text-sm font-medium">
        You&apos;ve done this route {rows.length} {rows.length === 1 ? 'time' : 'times'}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-muted-foreground text-xs">
            <tr className="border-b text-right [&>th]:py-1.5 [&>th]:font-medium">
              <th className="text-left">Date</th>
              <th>Distance</th>
              <th>Time</th>
              <th>Pace</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => {
              const time = timeOf(h)
              const current = h.id === hike.id
              return (
                <tr key={h.id} className={cn('border-b text-right last:border-0 [&>td]:py-1.5', current && 'font-semibold')}>
                  <td className="text-left">
                    {current ? (
                      <span>{formatDate(h.startedAt) ?? h.name} (this hike)</span>
                    ) : (
                      <Link to={`/hikes/${h.id}`} className="hover:underline">
                        {formatDate(h.startedAt) ?? h.name}
                      </Link>
                    )}
                  </td>
                  <td>{formatDistance(h.distanceM)}</td>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      {h === fastest && <Trophy className="size-3.5" aria-label="Fastest" />}
                      {time > 0 ? formatDuration(time) : '—'}
                    </span>
                  </td>
                  <td>{time > 0 && h.distanceM > 0 ? `${formatPace(time / 60 / (h.distanceM / 1000))} /km` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
