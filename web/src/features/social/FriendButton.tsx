import { ChevronDown, UserCheck, UserMinus, UserPlus, UserX } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ApiError } from '@/lib/api'

import type { Relation } from './api'
import { useAddFriend, useRemoveFriend } from './useSocial'

type Props = {
  userId: string
  relation: Relation
  size?: 'sm' | 'default'
}

/** The friendship action that fits the current relation. */
export function FriendButton({ userId, relation, size = 'default' }: Props) {
  const add = useAddFriend()
  const remove = useRemoveFriend()
  const busy = add.isPending || remove.isPending

  function onError(fallback: string) {
    return (err: unknown) => toast.error(err instanceof ApiError ? err.message : fallback)
  }

  const sendOrAccept = () =>
    add.mutate(userId, {
      onSuccess: (rel) => toast.success(rel === 'friends' ? 'You are now friends' : 'Friend request sent'),
      onError: onError('Could not send request'),
    })
  const drop = (message: string) =>
    remove.mutate(userId, { onSuccess: () => toast.success(message), onError: onError('Something went wrong') })

  switch (relation) {
    case 'none':
      return (
        <Button size={size} disabled={busy} onClick={sendOrAccept}>
          <UserPlus />
          Add friend
        </Button>
      )
    case 'outgoing':
      return (
        <Button size={size} variant="outline" disabled={busy} onClick={() => drop('Request cancelled')}>
          <UserX />
          Cancel request
        </Button>
      )
    case 'incoming':
      return (
        <div className="flex gap-2">
          <Button size={size} disabled={busy} onClick={sendOrAccept}>
            <UserCheck />
            Accept
          </Button>
          <Button size={size} variant="outline" disabled={busy} onClick={() => drop('Request declined')}>
            Decline
          </Button>
        </div>
      )
    case 'friends':
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size={size} variant="outline" disabled={busy}>
              <UserCheck />
              Friends
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => drop('Friend removed')}>
              <UserMinus />
              Remove friend
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    default:
      return null
  }
}
