import { UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { errorMessage } from '@/lib/errors'

import { useTagFriend, useUntag } from './api'

type Props = {
  hike: Hike
  isOwner: boolean
  viewerId: string | undefined
}

/** The friends tagged on a hike, with tagging for the owner and self-untagging for them. */
export function Participants({ hike, isOwner, viewerId }: Props) {
  const { t } = useTranslation()
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
          toast.success(t('participants.removed'))
          navigate(`/u/${hike.userId}`, { replace: true })
        },
        onError: () => toast.error(t('participants.removeFailed')),
      },
    )
  }

  return (
    <div className="flex items-center gap-2">
      {participants.length > 0 && (
        <>
          <span className="text-muted-foreground text-sm">{t('participants.with')}</span>
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
          {t('participants.removeMe')}
        </Button>
      )}
    </div>
  )
}

function TagDialog({ hike }: { hike: Hike }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const friends = useConnections().data?.friends
  const tag = useTagFriend()
  const untag = useUntag()
  const taggedIds = new Set(hike.participants?.map((p) => p.id))

  function toggle(userId: string) {
    const mutation = taggedIds.has(userId) ? untag : tag
    mutation.mutate(
      { hikeId: hike.id, userId },
      { onError: (err) => toast.error(errorMessage(err, t('participants.updateFailed'))) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus />
          {t('participants.tagFriends')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('participants.title')}</DialogTitle>
          <DialogDescription>
            {t('participants.description')}
          </DialogDescription>
        </DialogHeader>
        {friends?.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            {t('participants.noFriends')}{' '}
            <Link to="/friends" className="text-foreground underline">
              {t('participants.findHikers')}
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
                    {isTagged ? t('participants.untag') : t('participants.tag')}
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
