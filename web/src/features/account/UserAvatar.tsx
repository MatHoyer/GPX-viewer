import { blobatarUri } from 'blobatar/uri'
import { useMemo } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { User } from '@/features/auth/api'

/** The name to show for a user: their display name, else the local part of their email. */
export function displayName(user: Pick<User, 'name' | 'email'>): string {
  return user.name || user.email.split('@')[0]
}

type Props = {
  user: User
} & React.ComponentProps<typeof Avatar>

/** The user's uploaded picture, or a blobatar generated from their id. */
export function UserAvatar({ user, ...props }: Props) {
  // Seeded by id so the default picture survives name and email changes.
  const generated = useMemo(() => blobatarUri(user.id), [user.id])
  const alt = displayName(user)

  return (
    <Avatar {...props}>
      <AvatarImage src={user.avatarUrl ?? generated} alt={alt} />
      <AvatarFallback className="rounded-[inherit]">
        <img src={generated} alt={alt} className="size-full" />
      </AvatarFallback>
    </Avatar>
  )
}
