import { Blobatar } from '@blobatar/react'
import 'blobatar/motion.css'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

import { displayName, type Person } from './displayName'

type Props = {
  user: Person
} & React.ComponentProps<typeof Avatar>

/** The user's uploaded picture, or a blobatar generated from their id. */
export function UserAvatar({ user, className, ...props }: Props) {
  const alt = displayName(user)

  return (
    // The ring overlay would otherwise swallow the hover that animates the blobatar.
    <Avatar className={cn('after:pointer-events-none', className)} {...props}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={alt} />}
      <AvatarFallback className="rounded-[inherit] bg-transparent">
        {/* Seeded by id so it survives name and email changes. Animating
            renders inline SVG, which is what lets hover reach the shapes.
            Important so icon sizing from containers (e.g. sidebar buttons) can't shrink it. */}
        <Blobatar name={user.id} animate="hover" title={alt} className="size-full!" />
      </AvatarFallback>
    </Avatar>
  )
}
