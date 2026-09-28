import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Loader2, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/features/auth/useAuth'
import { ApiError } from '@/lib/api'
import { formatDate, formatDistance, formatDuration, formatElevation } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { Hike } from './api'
import { useHikeColors } from './colors'
import { DeleteHikesDialog } from './DeleteHikesDialog'
import { FilterBar } from './FilterBar'
import { filterHikes, useHikeFilters } from './filters'
import { HikeActionsMenu } from './HikeActionsMenu'
import { PlannedBadge } from './PlannedBadge'
import { sortHikes, type Sort, type SortKey } from './sort'
import { TaggedBy } from './TaggedBy'
import { useExportHikes, useHikes } from './useHikes'

/** Your hikes and those you were tagged on, as a sortable table with bulk export and delete. */
export function HikesPage() {
  const hikes = useHikes()
  const me = useMe()
  const userId = me.data?.id
  const filters = useHikeFilters((s) => s.filters)
  const [sort, setSort] = useState<Sort>({ key: 'date', desc: true })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Hike[]>([])
  const exportHikes = useExportHikes()

  const all = useMemo(() => hikes.data ?? [], [hikes.data])
  const colors = useHikeColors(all)
  const rows = useMemo(() => sortHikes(filterHikes(all, filters, userId), sort), [all, filters, userId, sort])
  // Only what is shown and yours can be acted on; a filter hides rows from the selection.
  const selectable = rows.filter((h) => h.userId === userId)
  const chosen = selectable.filter((h) => selected.has(h.id))
  const allChosen = selectable.length > 0 && chosen.length === selectable.length

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(selectable.map((h) => h.id)) : new Set())
  }

  function sortBy(key: SortKey) {
    // Numbers and dates start from the largest, names from A.
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' }))
  }

  function exportChosen() {
    exportHikes.mutate(
      chosen.map((h) => h.id),
      { onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not export') },
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">Hikes</h1>
      </header>

      {all.length > 0 && (
        <div className="border-b px-2 py-1.5 sm:px-4">
          {chosen.length > 0 ? (
            <div className="flex h-8 items-center gap-1.5">
              <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => toggleAll(false)}>
                <X />
              </Button>
              <span className="flex-1 text-sm font-medium tabular-nums">{chosen.length} selected</span>
              <Button variant="outline" size="sm" onClick={exportChosen} disabled={exportHikes.isPending}>
                {exportHikes.isPending ? <Loader2 className="animate-spin" /> : <Download />}
                Export GPX
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleting(chosen)}>
                <Trash2 />
                Delete
              </Button>
            </div>
          ) : (
            <FilterBar hikes={all} userId={userId} matched={rows.length} />
          )}
        </div>
      )}

      <main className="flex-1 overflow-auto">
        {hikes.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : hikes.isError ? (
          <p role="alert" className="text-destructive p-4 text-sm">
            Could not load your hikes.
          </p>
        ) : all.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">No hikes yet. Import GPX files to see them here.</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">No hikes match your filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background sticky top-0 z-10 shadow-[0_1px_0_var(--border)]">
              <tr className="text-muted-foreground text-left text-xs">
                <th className="w-10 py-2 pr-1 pl-3 sm:pl-5">
                  <Checkbox
                    aria-label="Select all your hikes shown"
                    checked={allChosen ? true : chosen.length > 0 ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    disabled={selectable.length === 0}
                  />
                </th>
                {/* Name takes the room left; the other columns fit their content. */}
                <SortHeader label="Name" sortKey="name" sort={sort} onSort={sortBy} className="w-full" />
                <SortHeader label="Date" sortKey="date" sort={sort} onSort={sortBy} className="hidden sm:table-cell" />
                <SortHeader label="Distance" sortKey="distance" sort={sort} onSort={sortBy} className="hidden text-right sm:table-cell" />
                <SortHeader label="D+" sortKey="elevation" sort={sort} onSort={sortBy} className="hidden text-right md:table-cell" />
                <SortHeader label="Duration" sortKey="duration" sort={sort} onSort={sortBy} className="hidden text-right lg:table-cell" />
                <th className="hidden px-2 py-2 font-medium xl:table-cell">Labels</th>
                <th className="w-12 py-2 pr-3 sm:pr-5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <HikeRow
                  key={h.id}
                  hike={h}
                  color={colors.get(h.id)}
                  userId={userId}
                  checked={selected.has(h.id)}
                  onCheck={(on) => toggle(h.id, on)}
                />
              ))}
            </tbody>
          </table>
        )}
      </main>

      <DeleteHikesDialog
        hikes={deleting}
        onClose={() => setDeleting([])}
        onDeleted={() => setSelected(new Set())}
      />
    </div>
  )
}

type SortHeaderProps = { label: string; sortKey: SortKey; sort: Sort; onSort: (key: SortKey) => void; className?: string }

function SortHeader({ label, sortKey, sort, onSort, className }: SortHeaderProps) {
  const active = sort.key === sortKey
  const Icon = !active ? ChevronsUpDown : sort.desc ? ArrowDown : ArrowUp
  const right = className?.includes('text-right')
  return (
    <th
      className={cn('px-2 py-2 font-medium', className)}
      aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'hover:text-foreground inline-flex items-center gap-1 rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          active && 'text-foreground',
          right && 'flex-row-reverse',
        )}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-50')} />
      </button>
    </th>
  )
}

type RowProps = {
  hike: Hike
  color: string | undefined
  userId: string | undefined
  checked: boolean
  onCheck: (on: boolean) => void
}

function HikeRow({ hike, color, userId, checked, onCheck }: RowProps) {
  const owned = hike.userId === userId
  const date = formatDate(hike.startedAt)
  const phoneDetails = [date, formatDistance(hike.distanceM), `${formatElevation(hike.elevationGainM)} D+`].filter(Boolean)

  return (
    <tr className={cn('hover:bg-muted/50 border-b transition-colors', checked && 'bg-primary/5 hover:bg-primary/10')}>
      <td className="py-2 pr-1 pl-3 sm:pl-5">
        <Checkbox
          aria-label={`Select ${hike.name}`}
          checked={checked}
          onCheckedChange={(v) => onCheck(v === true)}
          disabled={!owned}
          title={owned ? undefined : 'Only its owner can export or delete this hike'}
        />
      </td>
      <td className="max-w-0 px-2 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <Link to={`/hikes/${hike.id}`} className="min-w-0 truncate font-medium hover:underline">
            {hike.name}
          </Link>
          {hike.planned && <PlannedBadge />}
        </div>
        <TaggedBy hike={hike} userId={userId} className="mt-0.5 pl-4.5" />
        <p className="text-muted-foreground mt-0.5 truncate pl-4.5 text-xs tabular-nums sm:hidden">{phoneDetails.join(' · ')}</p>
      </td>
      <td className="text-muted-foreground hidden px-2 py-2 whitespace-nowrap tabular-nums sm:table-cell">{date ?? '—'}</td>
      <td className="hidden px-2 py-2 text-right whitespace-nowrap tabular-nums sm:table-cell">{formatDistance(hike.distanceM)}</td>
      <td className="hidden px-2 py-2 text-right whitespace-nowrap tabular-nums md:table-cell">
        {formatElevation(hike.elevationGainM)}
      </td>
      <td className="hidden px-2 py-2 text-right whitespace-nowrap tabular-nums lg:table-cell">{formatDuration(hike.durationS)}</td>
      <td className="hidden max-w-48 px-2 py-2 xl:table-cell">
        <div className="flex flex-wrap gap-1">
          {hike.labels.map((l) => (
            <span key={l} className="bg-muted rounded-full px-2 py-0.5 text-xs">
              {l}
            </span>
          ))}
        </div>
      </td>
      <td className="py-2 pr-3 text-right sm:pr-5">
        <HikeActionsMenu hike={hike} />
      </td>
    </tr>
  )
}
