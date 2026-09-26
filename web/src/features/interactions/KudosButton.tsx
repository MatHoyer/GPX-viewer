import { ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { Hike } from '@/features/hikes/api'
import { cn } from '@/lib/utils'

import { useKudos } from './api'

type Props = {
  hike: Hike
  /** The signed-in viewer; kudos need an account and can't go to your own hike. */
  viewerId: string | undefined
}

export function KudosButton({ hike, viewerId }: Props) {
  const kudos = useKudos()
  const count = hike.interactions?.kudos ?? 0
  const kudoed = hike.interactions?.kudoed ?? false
  const canGive = viewerId !== undefined && viewerId !== hike.userId

  if (!canGive) {
    if (count === 0) return null
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-sm tabular-nums" aria-label={`${count} kudos`}>
        <ThumbsUp className="size-4" />
        {count}
      </span>
    )
  }
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={kudoed}
      disabled={kudos.isPending}
      onClick={() =>
        kudos.mutate({ hikeId: hike.id, on: !kudoed }, { onError: () => toast.error('Could not update kudos') })
      }
      className={cn('tabular-nums', kudoed && 'border-primary bg-primary/10')}
    >
      <ThumbsUp className={cn(kudoed && 'fill-current')} />
      {kudoed ? 'Kudos given' : 'Give kudos'}
      {count > 0 && <span className="text-muted-foreground">· {count}</span>}
    </Button>
  )
}
