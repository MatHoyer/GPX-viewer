import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/** Marks a route that is planned rather than walked. */
export function PlannedBadge({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <span className={cn('text-muted-foreground shrink-0 rounded border border-dashed px-1 text-[10px] font-medium uppercase', className)}>
      {t('hike.planned')}
    </span>
  )
}
