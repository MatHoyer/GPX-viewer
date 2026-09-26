import { cn } from '@/lib/utils'

/** Marks a route that is planned rather than walked. */
export function PlannedBadge({ className }: { className?: string }) {
  return (
    <span className={cn('text-muted-foreground shrink-0 rounded border border-dashed px-1 text-[10px] font-medium uppercase', className)}>
      Planned
    </span>
  )
}
