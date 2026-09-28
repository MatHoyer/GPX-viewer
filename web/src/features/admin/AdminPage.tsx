import { MoreHorizontal, UserPlus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import { useConfig, useMe } from '@/features/auth/useAuth'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { AdminUser } from './api'
import { BanDialog } from './BanDialog'
import { InviteDialog } from './InviteDialog'
import { RevokeInviteDialog } from './RevokeInviteDialog'
import { useSetAdmin, useUnbanUser, useUsers } from './useAdmin'

export function AdminPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">Admin</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          <RegistrationCard />
          <UsersCard />
        </div>
      </main>
    </div>
  )
}

/** Read-only: the environment is the source of truth. */
function RegistrationCard() {
  const config = useConfig()
  const enabled = config.data?.registrationEnabled

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account creation</CardTitle>
        <CardDescription>
          Set by the <code className="font-mono">REGISTRATION_ENABLED</code> environment variable. Restart the app
          after changing it.
        </CardDescription>
        <CardAction>
          {enabled === undefined ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <Pill tone={enabled ? 'good' : 'muted'}>{enabled ? 'Open to all' : 'Invite only'}</Pill>
          )}
        </CardAction>
      </CardHeader>
      {enabled === false && (
        <CardContent className="text-muted-foreground text-sm">
          Nobody can sign up on their own. Invite people from the list below.
        </CardContent>
      )}
    </Card>
  )
}

type DialogState =
  | { kind: 'invite' }
  | { kind: 'reinvite' | 'revoke' | 'ban'; user: AdminUser }
  | null

function UsersCard() {
  const users = useUsers()
  const [dialog, setDialog] = useState<DialogState>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users{users.data && ` (${users.data.length})`}</CardTitle>
        <CardAction>
          <Button size="sm" onClick={() => setDialog({ kind: 'invite' })}>
            <UserPlus />
            Invite
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {users.data ? (
          <ul className="divide-y">
            {users.data.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onReinvite={() => setDialog({ kind: 'reinvite', user: u })}
                onRevoke={() => setDialog({ kind: 'revoke', user: u })}
                onBan={() => setDialog({ kind: 'ban', user: u })}
              />
            ))}
          </ul>
        ) : users.isError ? (
          <p role="alert" className="text-destructive text-sm">
            Could not load users.
          </p>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}
      </CardContent>
      <InviteDialog
        open={dialog?.kind === 'invite' || dialog?.kind === 'reinvite'}
        user={dialog?.kind === 'reinvite' ? dialog.user : undefined}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <RevokeInviteDialog user={dialog?.kind === 'revoke' ? dialog.user : null} onClose={() => setDialog(null)} />
      <BanDialog user={dialog?.kind === 'ban' ? dialog.user : null} onClose={() => setDialog(null)} />
    </Card>
  )
}

type RowProps = { user: AdminUser; onReinvite: () => void; onRevoke: () => void; onBan: () => void }

function UserRow({ user, onReinvite, onRevoke, onBan }: RowProps) {
  const me = useMe()
  const self = me.data?.id === user.id
  const unban = useUnbanUser()
  const setAdmin = useSetAdmin()
  const busy = unban.isPending || setAdmin.isPending
  const name = displayName(user)
  const onError = (fallback: string) => (err: Error) =>
    toast.error(err instanceof ApiError ? err.message : fallback)

  const meta = [
    `Joined ${formatDate(user.createdAt)}`,
    user.lastSeenAt && `last seen ${formatDate(user.lastSeenAt)}`,
    `${user.hikes} ${user.hikes === 1 ? 'hike' : 'hikes'}`,
  ].filter(Boolean)

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <UserAvatar user={user} className="mt-0.5 size-9" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-medium">{name}</span>
          {self && <span className="text-muted-foreground text-xs">(you)</span>}
          {user.isAdmin && <Pill tone="primary">Admin</Pill>}
          {user.bannedAt ? (
            <Pill tone="danger">Banned</Pill>
          ) : (
            !user.emailVerifiedAt && <Pill tone="muted">Not signed in yet</Pill>
          )}
        </div>
        <p className="text-muted-foreground truncate text-sm">{user.email}</p>
        <p className="text-muted-foreground text-xs">{meta.join(' · ')}</p>
        {user.bannedAt && (
          <p className="text-destructive text-xs break-words">
            Banned {formatDate(user.bannedAt)}: {user.banReason}
          </p>
        )}
      </div>
      {!self && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0" disabled={busy} aria-label={`Manage ${name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!user.emailVerifiedAt && (
              <>
                <DropdownMenuItem onSelect={onReinvite}>New invite link…</DropdownMenuItem>
                {user.hikes === 0 && (
                  <DropdownMenuItem variant="destructive" onSelect={onRevoke}>
                    Revoke invite…
                  </DropdownMenuItem>
                )}
              </>
            )}
            {!user.bannedAt && (
              <DropdownMenuItem
                onSelect={() =>
                  setAdmin.mutate(
                    { id: user.id, admin: !user.isAdmin },
                    {
                      onSuccess: () => toast.success(user.isAdmin ? `${name} is no longer an admin` : `${name} is now an admin`),
                      onError: onError('Could not change their role'),
                    },
                  )
                }
              >
                {user.isAdmin ? 'Remove admin role' : 'Make admin'}
              </DropdownMenuItem>
            )}
            {!user.isAdmin && (
              <>
                <DropdownMenuSeparator />
                {user.bannedAt ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      unban.mutate(user.id, {
                        onSuccess: () => toast.success(`${name} can sign in again`),
                        onError: onError('Could not lift the ban'),
                      })
                    }
                  >
                    Lift ban
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem variant="destructive" onSelect={onBan}>
                    Ban…
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}

const pillTones = {
  primary: 'bg-primary/10 text-primary',
  good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  danger: 'bg-destructive/10 text-destructive',
  muted: 'bg-muted text-muted-foreground',
}

function Pill({ tone, children }: { tone: keyof typeof pillTones; children: ReactNode }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', pillTones[tone])}>
      {children}
    </span>
  )
}
