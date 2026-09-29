import {
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type Column,
  type Row,
  type ColumnVisibilityState,
  Subscribe,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Loader2, Trash2, X } from 'lucide-react'
import { createContext, use, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/features/auth/useAuth'
import i18n from '@/i18n'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDistance, formatDuration, formatElevation } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { Hike } from './api'
import { useHikeColors } from './colors'
import { fitColumns, optionalColumns } from './columnFit'
import { DeleteHikesDialog } from './DeleteHikesDialog'
import { FilterBar } from './FilterBar'
import { filterHikes, useHikeFilters } from './filters'
import { HikeActionsMenu } from './HikeActionsMenu'
import { PlannedBadge } from './PlannedBadge'
import { TaggedBy } from './TaggedBy'
import { useExportHikes, useHikes } from './useHikes'

// Only what this table uses: sorting, selection, fixed column widths, and
// hiding columns that do not fit the viewport.
const features = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
})

type HikeColumn = Column<typeof features, Hike>
type HikeRow = Row<typeof features, Hike>

/** Who is looking and the map colors; cells read them instead of rebuilding the columns. */
const HikeTableContext = createContext<{ userId: string | undefined; colors: Map<string, string> }>({
  userId: undefined,
  colors: new Map(),
})

const helper = createColumnHelper<typeof features, Hike>()

function sizeOf(id: (typeof optionalColumns)[number]['id']) {
  return optionalColumns.find((c) => c.id === id)!.size
}

// Sizes are pixels for a fixed layout; the name column (no size) takes what is left.
const columns = helper.columns([
  helper.display({ id: 'select', size: 44, header: SelectAllHeader, cell: SelectCell }),
  helper.accessor('name', {
    header: () => i18n.t('hikes.columns.name'),
    sortFn: 'alphanumeric',
    sortDescFirst: false,
    cell: NameCell,
  }),
  helper.accessor((h) => (h.startedAt ? Date.parse(h.startedAt) : undefined), {
    id: 'date',
    header: () => i18n.t('hikes.columns.date'),
    size: sizeOf('date'),
    sortUndefined: 'last',
    sortDescFirst: true,
    cell: ({ row }) => formatDate(row.original.startedAt) ?? '—',
  }),
  helper.accessor('distanceM', {
    id: 'distance',
    header: () => i18n.t('hike.distance'),
    size: sizeOf('distance'),
    sortDescFirst: true,
    cell: ({ getValue }) => formatDistance(getValue()),
  }),
  helper.accessor('elevationGainM', {
    id: 'elevation',
    header: () => i18n.t('hikes.columns.gain'),
    size: sizeOf('elevation'),
    sortDescFirst: true,
    cell: ({ getValue }) => formatElevation(getValue()),
  }),
  helper.accessor((h) => (h.durationS > 0 ? h.durationS : undefined), {
    id: 'duration',
    header: () => i18n.t('hikes.columns.duration'),
    size: sizeOf('duration'),
    sortUndefined: 'last',
    sortDescFirst: true,
    cell: ({ getValue }) => formatDuration(getValue() ?? 0),
  }),
  helper.accessor('labels', {
    header: () => i18n.t('hikes.columns.labels'),
    size: sizeOf('labels'),
    enableSorting: false,
    cell: LabelsCell,
  }),
  helper.display({ id: 'actions', size: 52, cell: ({ row }) => <HikeActionsMenu hike={row.original} /> }),
])

const numeric = new Set(['distance', 'elevation', 'duration'])
const EMPTY: Hike[] = []

/**
 * The columns that fit the element's width, which the sidebar makes narrower
 * than the viewport. Without the date column, the name cell carries a summary.
 */
function useColumnVisibility(ref: RefObject<HTMLElement | null>): ColumnVisibilityState {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return useMemo(() => fitColumns(width), [width])
}

/** Your hikes and those you were tagged on, as a sortable table with bulk export and delete. */
export function HikesPage() {
  const { t } = useTranslation()
  const hikes = useHikes()
  const me = useMe()
  const userId = me.data?.id
  const filters = useHikeFilters((s) => s.filters)
  const all = hikes.data ?? EMPTY
  const colors = useHikeColors(all)
  const data = useMemo(() => filterHikes(all, filters, userId), [all, filters, userId])
  const mainRef = useRef<HTMLElement>(null)
  const columnVisibility = useColumnVisibility(mainRef)
  const [deleting, setDeleting] = useState<Hike[]>([])
  const exportHikes = useExportHikes()

  // Sorting and selection live in the table's store; visibility follows the available width only.
  const table = useTable(
    {
      features,
      columns,
      data,
      getRowId: (h) => h.id,
      // Hikes you were tagged on belong to their owner: no export or delete.
      enableRowSelection: (row) => row.original.userId === userId,
      initialState: { sorting: [{ id: 'date', desc: true }] },
      enableSortingRemoval: false,
      state: { columnVisibility },
      onColumnVisibilityChange: () => {},
    },
    (state) => ({ sorting: state.sorting }),
  )
  const context = useMemo(() => ({ userId, colors }), [userId, colors])

  function exportSelected(rows: HikeRow[]) {
    exportHikes.mutate(
      rows.map((r) => r.original.id),
      { onError: (err) => toast.error(errorMessage(err, t('hikes.exportFailed'))) },
    )
  }

  const rows = table.getRowModel().rows
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">{t('nav.hikes')}</h1>
      </header>

      {all.length > 0 && (
        <div className="border-b px-2 py-1.5 sm:px-4">
          {/* Selected rows the current filters hide are left out of bulk actions. */}
          <table.Subscribe source={table.atoms.rowSelection}>
            {() => {
              const selected = table.getSelectedRowModel().rows
              return selected.length > 0 ? (
                <div className="flex h-10 items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('hikes.clearSelection')}
                    onClick={() => table.resetRowSelection(true)}
                  >
                    <X />
                  </Button>
                  <span className="flex-1 text-sm font-medium tabular-nums">{t('hikes.selected', { count: selected.length })}</span>
                  <Button variant="outline" size="sm" onClick={() => exportSelected(selected)} disabled={exportHikes.isPending}>
                    {exportHikes.isPending ? <Loader2 className="animate-spin" /> : <Download />}
                    {t('hikes.exportGpx')}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleting(selected.map((r) => r.original))}>
                    <Trash2 />
                    {t('common.delete')}
                  </Button>
                </div>
              ) : (
                <FilterBar hikes={all} userId={userId} matched={data.length} />
              )
            }}
          </table.Subscribe>
        </div>
      )}

      <main ref={mainRef} className="flex-1 overflow-y-auto">
        {hikes.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : hikes.isError ? (
          <p role="alert" className="text-destructive p-4 text-sm">
            {t('hikes.loadFailed')}
          </p>
        ) : all.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">{t('hikes.empty')}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">{t('hikes.noMatch')}</p>
        ) : (
          <HikeTableContext value={context}>
            <table className="w-full table-fixed text-sm">
              <colgroup>
                {table.getVisibleLeafColumns().map((column) => (
                  <col key={column.id} style={column.id === 'name' ? undefined : { width: column.getSize() }} />
                ))}
              </colgroup>
              <thead className="bg-background sticky top-0 z-10 shadow-[0_1px_0_var(--border)]">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id} className="text-muted-foreground text-left text-xs">
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        className={cn(
                          'px-2 py-2 font-medium',
                          numeric.has(header.column.id) && 'text-right',
                          header.column.id === 'select' && 'pl-3 sm:pl-5',
                        )}
                        aria-sort={ariaSort(header.column)}
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <SortButton column={header.column}>
                            <table.FlexRender header={header} />
                          </SortButton>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map((row) => (
                  <table.Subscribe key={row.id} source={table.atoms.rowSelection} selector={(s) => !!s[row.id]}>
                    {(selected) => (
                      <tr className={cn('hover:bg-muted/50 border-b transition-colors', selected && 'bg-primary/5 hover:bg-primary/10')}>
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={cn(
                              'px-2 py-2',
                              numeric.has(cell.column.id) && 'text-right whitespace-nowrap tabular-nums',
                              cell.column.id === 'date' && 'text-muted-foreground whitespace-nowrap tabular-nums',
                              cell.column.id === 'select' && 'pl-3 sm:pl-5',
                              cell.column.id === 'actions' && 'text-right',
                            )}
                          >
                            <table.FlexRender cell={cell} />
                          </td>
                        ))}
                      </tr>
                    )}
                  </table.Subscribe>
                ))}
              </tbody>
            </table>
          </HikeTableContext>
        )}
      </main>

      <DeleteHikesDialog
        hikes={deleting}
        onClose={() => setDeleting([])}
        onDeleted={() => table.resetRowSelection(true)}
      />
    </div>
  )
}

function ariaSort(column: HikeColumn) {
  const dir = column.getIsSorted()
  return dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined
}

function SortButton({ column, children }: { column: HikeColumn; children: ReactNode }) {
  const dir = column.getIsSorted()
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ChevronsUpDown
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={cn(
        'hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm transition-colors outline-none focus-visible:ring-2',
        dir && 'text-foreground',
        numeric.has(column.id) && 'flex-row-reverse',
      )}
    >
      {children}
      <Icon className={cn('size-3.5', !dir && 'opacity-50')} />
    </button>
  )
}

function SelectAllHeader({ table }: { table: HikeRow['table'] }) {
  return (
    <Subscribe source={table.atoms.rowSelection}>
      {() => {
        const all = table.getIsAllRowsSelected()
        const some = table.getIsSomeRowsSelected()
        return (
          <Checkbox
            aria-label={i18n.t('hikes.selectAll')}
            checked={all ? true : some ? 'indeterminate' : false}
            onCheckedChange={(v) => table.toggleAllRowsSelected(v === true)}
            disabled={!table.getRowModel().rows.some((r) => r.getCanSelect())}
          />
        )
      }}
    </Subscribe>
  )
}

function SelectCell({ row }: { row: HikeRow }) {
  const canSelect = row.getCanSelect()
  return (
    <Subscribe source={row.table.atoms.rowSelection} selector={(s) => !!s[row.id]}>
      {(selected) => (
        <Checkbox
          aria-label={i18n.t('hikes.select', { name: row.original.name })}
          checked={selected}
          disabled={!canSelect}
          title={canSelect ? undefined : i18n.t('hikes.ownerOnly')}
          // Through the table's handler so Shift+click selects a range. The
          // checkbox is a button, so its next state is passed as target.checked.
          onClick={(e) => row.getToggleSelectedHandler()({ shiftKey: e.shiftKey, target: { checked: !selected } })}
          onMouseDown={(e) => e.shiftKey && e.preventDefault()}
        />
      )}
    </Subscribe>
  )
}

function NameCell({ row }: { row: HikeRow }) {
  const { userId, colors } = use(HikeTableContext)
  const hike = row.original
  // Shown when the date and distance columns are hidden, on phones.
  const summary = !row.table.getColumn('date')?.getIsVisible()
    ? [formatDate(hike.startedAt), formatDistance(hike.distanceM), i18n.t('hike.gainValue', { value: formatElevation(hike.elevationGainM) })].filter(Boolean)
    : null

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors.get(hike.id) }} aria-hidden />
        <Link to={`/hikes/${hike.id}`} className="min-w-0 truncate font-medium hover:underline">
          {hike.name}
        </Link>
        {hike.planned && <PlannedBadge />}
      </div>
      <TaggedBy hike={hike} userId={userId} className="mt-0.5 pl-4.5" />
      {summary && <p className="text-muted-foreground mt-0.5 truncate pl-4.5 text-xs tabular-nums">{summary.join(' · ')}</p>}
    </div>
  )
}

function LabelsCell({ row }: { row: HikeRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.original.labels.map((l) => (
        <span key={l} className="bg-muted rounded-full px-2 py-0.5 text-xs">
          {l}
        </span>
      ))}
    </div>
  )
}
