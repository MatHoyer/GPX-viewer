import { UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import type { Hike } from '@/features/hikes/api'
import { useConnections } from '@/features/social/useSocial'
import { ApiError } from '@/lib/api'

import { useTagFriend, useUntag } from './api'

type Props = {
  hike: Hike
  isOwner: boolean
  viewerId: string | undefined
}

/** The friends tagged on a hike, with tagging for the owner and self-untagging for them. */
export function Participants({ hike, isOwner, viewerId }: Props) {
  const navigate = useNavigate()
  const untag = useUntag()
  const participants = hike.participants ?? []
  const tagged = viewerId !== undefined && participants.some((p) => p.id === viewerId)

  if (participants.length === 0 && !isOwner) return null

  function leave() {
    untag.mutate(
      { hikeId: hike.id, userId: viewerId! },
      {
        onSuccess: () => {
          toast.success('Removed from this hike')
          navigate(`/u/${hike.userId}`, { replace: true })
        },
        onError: () => toast.error('Could not remove you from this hike'),
      },
    )
  }

  return (
    <div className="flex items-center gap-2">
      {participants.length > 0 && (
        <>
          <span className="text-muted-foreground text-sm">with</span>
          <div className="flex -space-x-2">
            {participants.map((p) => (
              <Tooltip key={p.id}>
                <TooltipTrigger asChild>
                  <Link to={`/u/${p.id}`} className="ring-background rounded-full ring-2">
                    <UserAvatar user={p} className="size-7" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{displayName(p)}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </>
      )}
      {isOwner && <TagDialog hike={hike} />}
      {tagged && !isOwner && (
        <Button variant="ghost" size="sm" disabled={untag.isPending} onClick={leave}>
          <UserMinus />
          Remove me
        </Button>
      )}
    </div>
  )
}

function TagDialog({ hike }: { hike: Hike }) {
  const [open, setOpen] = useState(false)
  const friends = useConnections().data?.friends
  const tag = useTagFriend()
  const untag = useUntag()
  const taggedIds = new Set(hike.participants?.map((p) => p.id))

  function toggle(userId: string) {
    const mutation = taggedIds.has(userId) ? untag : tag
    mutation.mutate(
      { hikeId: hike.id, userId },
      { onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update the hike') },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus />
          Tag friends
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Who hiked with you?</DialogTitle>
          <DialogDescription>
            Tagged friends get this hike on their map and profile, and anyone who can see their profile can see it.
          </DialogDescription>
        </DialogHeader>
        {friends?.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No friends yet.{' '}
            <Link to="/friends" className="text-foreground underline">
              Find hikers
            </Link>
          </p>
        ) : (
          <ul className="-mx-2 max-h-80 overflow-y-auto">
            {friends?.map((f) => {
              const isTagged = taggedIds.has(f.id)
              return (
                <li key={f.id} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                  <UserAvatar user={f} className="size-8" />
                  <span className="min-w-0 flex-1 truncate font-medium">{displayName(f)}</span>
                  <Button
                    size="sm"
                    variant={isTagged ? 'outline' : 'default'}
                    disabled={tag.isPending || untag.isPending}
                    onClick={() => toggle(f.id)}
                  >
                    {isTagged ? 'Untag' : 'Tag'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
