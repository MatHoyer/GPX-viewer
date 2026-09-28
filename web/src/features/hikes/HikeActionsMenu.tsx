import { CalendarCheck, Download, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMe } from '@/features/auth/useAuth'
import { MarkDoneDialog } from '@/features/hike-detail/MarkDoneDialog'
import { cn } from '@/lib/utils'

import type { Hike } from './api'
import { DeleteHikesDialog } from './DeleteHikesDialog'

type Props = {
  hike: Hike
  className?: string
  /** Leaves out "Open", for where the hike is already open. */
  hideOpen?: boolean
  size?: 'icon-sm' | 'icon-xs'
  onDeleted?: () => void
}

/** The actions on a hike, behind an ellipsis button. Owner-only ones are hidden from participants. */
export function HikeActionsMenu({ hike, className, hideOpen, size = 'icon-sm', onDeleted }: Props) {
  const isOwner = useMe().data?.id === hike.userId
  const [dialog, setDialog] = useState<'done' | 'delete' | null>(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={size} className={cn('shrink-0', className)} aria-label={`Actions for ${hike.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {!hideOpen && (
            <DropdownMenuItem asChild>
              <Link to={`/hikes/${hike.id}`}>
                <ExternalLink />
                Open
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <a href={`/api/hikes/${hike.id}/gpx`} download>
              <Download />
              Download GPX
            </a>
          </DropdownMenuItem>
          {isOwner && hike.planned && (
            <DropdownMenuItem onSelect={() => setDialog('done')}>
              <CalendarCheck />
              Mark as done…
            </DropdownMenuItem>
          )}
          {isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
                <Trash2 />
                Delete…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {isOwner && hike.planned && (
        <MarkDoneDialog id={hike.id} open={dialog === 'done'} onOpenChange={(open) => !open && setDialog(null)} />
      )}
      <DeleteHikesDialog hikes={dialog === 'delete' ? [hike] : []} onClose={() => setDialog(null)} onDeleted={onDeleted} />
    </>
  )
}
