import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { displayName, type Person } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import { cn } from '@/lib/utils'

import type { Hike } from './api'
import { activeFilterCount, hikePeople, useHikeFilters } from './filters'

type Props = {
  /** All the user's hikes, to offer their labels and people as filters. */
  hikes: Hike[]
  userId: string | undefined
  /** How many hikes match the current filters. */
  matched: number
  className?: string
}

/** Search box plus a sheet of filters on the user's hikes. */
export function FilterBar({ hikes, userId, matched, className }: Props) {
  const { filters, setFilters, clearFilters } = useHikeFilters()
  const active = activeFilterCount(filters)

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={filters.query}
          onChange={(e) => setFilters({ query: e.target.value })}
          placeholder="Search hikes"
          aria-label="Search hikes"
          className="bg-background h-8 w-36 pl-7 sm:w-52"
        />
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="bg-background">
            <SlidersHorizontal />
            <span className="hidden sm:inline">Filters</span>
            {active > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs tabular-nums">{active}</span>
            )}
          </Button>
        </SheetTrigger>
        <FilterSheet hikes={hikes} userId={userId} matched={matched} />
      </Sheet>
      {active > 0 && (
        <>
          <span className="bg-background/80 text-muted-foreground hidden rounded px-1.5 text-xs tabular-nums sm:inline">
            {matched} of {hikes.length}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={clearFilters} aria-label="Clear filters" title="Clear filters">
            <X />
          </Button>
        </>
      )}
    </div>
  )
}

function FilterSheet({ hikes, userId, matched }: Omit<Props, 'className'>) {
  const { filters, setFilters, clearFilters } = useHikeFilters()

  // Labels by how often they are used; people by name.
  const { labels, people } = useMemo(() => {
    const labelCounts = new Map<string, number>()
    const people = new Map<string, Person>()
    for (const h of hikes) {
      for (const l of h.labels) labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1)
      for (const p of hikePeople(h, userId)) people.set(p.id, p)
    }
    return {
      labels: [...labelCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l),
      people: [...people.values()].sort((a, b) => displayName(a).localeCompare(displayName(b))),
    }
  }, [hikes, userId])

  function toggle(key: 'labels' | 'people', value: string) {
    const list = filters[key]
    setFilters({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }

  return (
    <SheetContent className="overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Filters</SheetTitle>
        <SheetDescription>
          {matched} of {hikes.length} hikes match.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-4">
        <Chips label="Show" hint="Walked hikes or planned routes">
          {(
            [
              ['all', 'All'],
              ['done', 'Done'],
              ['planned', 'Planned'],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} pressed={filters.status === value} onClick={() => setFilters({ status: value })}>
              {label}
            </Chip>
          ))}
        </Chips>
        <Range
          label="Date"
          type="date"
          min={filters.from}
          max={filters.to}
          onChange={(from, to) => setFilters({ from, to })}
        />
        <NumberRange
          label="Distance (km)"
          min={filters.minKm}
          max={filters.maxKm}
          onChange={(minKm, maxKm) => setFilters({ minKm, maxKm })}
        />
        <NumberRange
          label="Elevation gain (m)"
          min={filters.minGainM}
          max={filters.maxGainM}
          onChange={(minGainM, maxGainM) => setFilters({ minGainM, maxGainM })}
        />
        {labels.length > 0 && (
          <Chips label="Labels" hint="Hikes with all of them">
            {labels.map((l) => (
              <Chip key={l} pressed={filters.labels.includes(l)} onClick={() => toggle('labels', l)}>
                {l}
              </Chip>
            ))}
          </Chips>
        )}
        {people.length > 0 && (
          <Chips label="With" hint="Hikes shared with all of them">
            {people.map((p) => (
              <Chip key={p.id} pressed={filters.people.includes(p.id)} onClick={() => toggle('people', p.id)}>
                <UserAvatar user={p} className="-ml-1 size-4" />
                {displayName(p)}
              </Chip>
            ))}
          </Chips>
        )}
      </div>

      <SheetFooter>
        <Button variant="outline" onClick={clearFilters} disabled={activeFilterCount(filters) === 0}>
          Clear all
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}

function Range({
  label,
  type,
  min,
  max,
  onChange,
}: {
  label: string
  type: 'date' | 'number'
  min: string
  max: string
  onChange: (min: string, max: string) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex items-center gap-2">
        <Input type={type} value={min} onChange={(e) => onChange(e.target.value, max)} aria-label={`${label} from`} min={0} />
        <span className="text-muted-foreground">–</span>
        <Input type={type} value={max} onChange={(e) => onChange(min, e.target.value)} aria-label={`${label} to`} min={0} />
      </div>
    </fieldset>
  )
}

function NumberRange({
  label,
  min,
  max,
  onChange,
}: {
  label: string
  min: number | null
  max: number | null
  onChange: (min: number | null, max: number | null) => void
}) {
  const parse = (v: string) => (v === '' || Number.isNaN(Number(v)) ? null : Number(v))
  return (
    <Range
      label={label}
      type="number"
      min={min?.toString() ?? ''}
      max={max?.toString() ?? ''}
      onChange={(a, b) => onChange(parse(a), parse(b))}
    />
  )
}

function Chips({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label asChild>
        <p>
          {label} <span className="text-muted-foreground text-xs font-normal">{hint}</span>
        </p>
      </Label>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'hover:bg-muted focus-visible:ring-ring/50 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-3',
        pressed && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {children}
    </button>
  )
}
