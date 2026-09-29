import { EllipsisVertical, UserCheck, UserMinus, UserPlus, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { errorMessage } from '@/lib/errors'

import type { Relation } from './api'
import { useAddFriend, useRemoveFriend } from './useSocial'

type Props = {
  userId: string
  relation: Relation
  size?: 'sm' | 'default'
  /** Show a "Friends" label next to the menu; off where every row is a friend. */
  showStatus?: boolean
}

/** The friendship action that fits the current relation. */
export function FriendButton({ userId, relation, size = 'default', showStatus = true }: Props) {
  const { t } = useTranslation()
  const add = useAddFriend()
  const remove = useRemoveFriend()
  const busy = add.isPending || remove.isPending

  function onError(fallback: string) {
    return (err: unknown) => toast.error(errorMessage(err, fallback))
  }

  const sendOrAccept = () =>
    add.mutate(userId, {
      onSuccess: (rel) => toast.success(rel === 'friends' ? t('friends.nowFriends') : t('friends.requestSent')),
      onError: onError(t('friends.requestFailed')),
    })
  const drop = (message: string) =>
    remove.mutate(userId, { onSuccess: () => toast.success(message), onError: onError(t('errors.generic')) })

  switch (relation) {
    case 'none':
      return (
        <Button size={size} disabled={busy} onClick={sendOrAccept}>
          <UserPlus />
          {t('friends.add')}
        </Button>
      )
    case 'outgoing':
      return (
        <Button size={size} variant="outline" disabled={busy} onClick={() => drop(t('friends.requestCancelled'))}>
          <UserX />
          {t('friends.cancelRequest')}
        </Button>
      )
    case 'incoming':
      return (
        <div className="flex gap-2">
          <Button size={size} disabled={busy} onClick={sendOrAccept}>
            <UserCheck />
            {t('friends.accept')}
          </Button>
          <Button size={size} variant="outline" disabled={busy} onClick={() => drop(t('friends.requestDeclined'))}>
            {t('friends.decline')}
          </Button>
        </div>
      )
    case 'friends':
      return (
        <div className="flex items-center gap-1">
          {showStatus && (
            <span className="text-muted-foreground flex items-center gap-1.5 px-1 text-sm">
              <UserCheck className="size-4" />
              {t('nav.friends')}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size={size === 'sm' ? 'icon-sm' : 'icon'} variant="ghost" disabled={busy} aria-label={t('friends.options')}>
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => drop(t('friends.removed'))}>
                <UserMinus />
                {t('friends.remove')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    default:
      return null
  }
}
