import { UsersRound } from 'lucide-react'
import { Trans } from 'react-i18next'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'

import type { Hike } from './api'
import { taggedBy } from './owner'

type Props = {
  hike: Hike
  /** Whose list the hike is shown in. */
  userId: string | undefined
  /** False inside an element that is already a link. */
  link?: boolean
  className?: string
}

/** A "tagged by Alice" line, like GitHub's "forked from", for hikes someone else owns. */
export function TaggedBy({ hike, userId, link = true, className }: Props) {
  const name = taggedBy(hike, userId)
  if (!name) return null
  return (
    <p className={cn('text-muted-foreground flex min-w-0 items-center gap-1 text-xs', className)}>
      <UsersRound className="size-3 shrink-0" />
      <span className="truncate">
        <Trans
          i18nKey="hike.taggedBy"
          values={{ name }}
          components={{
            name: link ? (
              <Link to={`/u/${hike.userId}`} className="text-foreground hover:underline" />
            ) : (
              <span className="text-foreground" />
            ),
          }}
        />
      </span>
    </p>
  )
}
