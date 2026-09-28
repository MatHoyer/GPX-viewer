import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import { useMe } from '@/features/auth/useAuth'
import { SessionList } from '@/features/sessions/SessionList'
import { ApiError } from '@/lib/api'
import { formatDate, formatRelative } from '@/lib/format'

import type { AdminUser } from './api'
import { BanDialog } from './BanDialog'
import { InviteDialog } from './InviteDialog'
import { UserPills } from './Pill'
import { RevokeInviteDialog } from './RevokeInviteDialog'
import {
  useRevokeUserSession,
  useRevokeUserSessions,
  useSetAdmin,
  useSetEmailVerified,
  useUnbanUser,
  useUser,
  useUserSessions,
} from './useAdmin'

const onError = (fallback: string) => (err: Error) => toast.error(err instanceof ApiError ? err.message : fallback)

/** One user as an admin sees them: account details, what can be done to it, and its sessions. */
export function AdminUserPage() {
  const { id = '' } = useParams()
  const user = useUser(id)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <Button asChild variant="ghost" size="icon" aria-label="Back to users">
          <Link to="/admin">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="truncate text-lg font-semibold">{user.data ? displayName(user.data) : 'User'}</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          {user.data ? (
            <>
              <AccountCard user={user.data} />
              <ActionsCard user={user.data} />
              <SessionsCard user={user.data} />
            </>
          ) : user.isError ? (
            <p role="alert" className="text-destructive text-sm">
              {user.error instanceof ApiError && user.error.status === 404
                ? 'This user does not exist anymore.'
                : 'Could not load this user.'}
            </p>
          ) : (
            <Skeleton className="h-48" />
          )}
        </div>
      </main>
    </div>
  )
}

function AccountCard({ user }: { user: AdminUser }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <UserAvatar user={user} className="size-12" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <CardTitle className="truncate">{displayName(user)}</CardTitle>
              <UserPills user={user} />
            </div>
            <CardDescription className="truncate">{user.email}</CardDescription>
          </div>
        </div>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/u/${user.id}`}>
              Profile
              <ExternalLink />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {user.bannedAt && (
          <p className="bg-destructive/10 text-destructive mb-4 rounded-lg px-3 py-2 text-sm break-words">
            Banned {formatDate(user.bannedAt)}: {user.banReason}
          </p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          <Fact label="Joined">{formatDate(user.createdAt)}</Fact>
          <Fact label="Email confirmed">{formatDate(user.emailVerifiedAt) ?? 'Not yet'}</Fact>
          <Fact label="Last active">{user.lastSeenAt ? formatRelative(user.lastSeenAt) : 'Not signed in'}</Fact>
          <Fact label="Hikes">{user.hikes}</Fact>
        </dl>
      </CardContent>
    </Card>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

type Dialog = 'reinvite' | 'revoke' | 'ban' | null

function ActionsCard({ user }: { user: AdminUser }) {
  const me = useMe()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<Dialog>(null)
  const unban = useUnbanUser()
  const setAdmin = useSetAdmin()
  const setVerified = useSetEmailVerified()
  const name = displayName(user)

  if (me.data?.id === user.id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>This is you. Ask another admin to change your role.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const pending = user.invitedAt !== null
  const verified = user.emailVerifiedAt !== null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {!user.bannedAt && (
          <Button variant="outline" onClick={() => setDialog('reinvite')}>
            {pending ? 'New invite link' : 'Password link'}
          </Button>
        )}
        {!pending && (
          <Button
            variant="outline"
            disabled={setVerified.isPending}
            onClick={() =>
              setVerified.mutate(
                { id: user.id, verified: !verified },
                {
                  onSuccess: () => toast.success(verified ? 'Email marked as not verified' : 'Email marked as verified'),
                  onError: onError('Could not change the email status'),
                },
              )
            }
          >
            {verified ? 'Mark email unverified' : 'Mark email verified'}
          </Button>
        )}
        {!user.bannedAt && (
          <Button
            variant="outline"
            disabled={setAdmin.isPending}
            onClick={() =>
              setAdmin.mutate(
                { id: user.id, admin: !user.isAdmin },
                {
                  onSuccess: () =>
                    toast.success(user.isAdmin ? `${name} is no longer an admin` : `${name} is now an admin`),
                  onError: onError('Could not change their role'),
                },
              )
            }
          >
            {user.isAdmin ? 'Remove admin role' : 'Make admin'}
          </Button>
        )}
        {!user.isAdmin &&
          (user.bannedAt ? (
            <Button
              variant="outline"
              disabled={unban.isPending}
              onClick={() =>
                unban.mutate(user.id, {
                  onSuccess: () => toast.success(`${name} can sign in again`),
                  onError: onError('Could not lift the ban'),
                })
              }
            >
              Lift ban
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setDialog('ban')}>
              Ban…
            </Button>
          ))}
        {pending && user.hikes === 0 && (
          <Button variant="destructive" onClick={() => setDialog('revoke')}>
            Revoke invite…
          </Button>
        )}
      </CardContent>
      <InviteDialog open={dialog === 'reinvite'} user={user} onOpenChange={(open) => !open && setDialog(null)} />
      <BanDialog user={dialog === 'ban' ? user : null} onClose={() => setDialog(null)} />
      <RevokeInviteDialog
        user={dialog === 'revoke' ? user : null}
        onClose={() => setDialog(null)}
        onRevoked={() => navigate('/admin', { replace: true })}
      />
    </Card>
  )
}

function SessionsCard({ user }: { user: AdminUser }) {
  const me = useMe()
  const sessions = useUserSessions(user.id)
  const revoke = useRevokeUserSession()
  const revokeAll = useRevokeUserSessions()
  const self = me.data?.id === user.id

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>
          {self
            ? 'Manage your own sessions from Settings.'
            : 'Devices this user is signed in on. Signing them out does not stop them signing in again; ban them for that.'}
        </CardDescription>
        {!self && sessions.data && sessions.data.length > 0 && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={revokeAll.isPending}
              onClick={() =>
                revokeAll.mutate(user.id, {
                  onSuccess: () => toast.success(`${displayName(user)} is signed out everywhere`),
                  onError: onError('Could not sign them out'),
                })
              }
            >
              Sign out everywhere
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {sessions.data ? (
          <SessionList
            sessions={sessions.data}
            revoking={revoke.isPending ? revoke.variables.id : undefined}
            onRevoke={
              self
                ? undefined
                : (s) => revoke.mutate({ userId: user.id, id: s.id }, { onError: onError('Could not sign out that device') })
            }
          />
        ) : sessions.isError ? (
          <p role="alert" className="text-destructive text-sm">
            Could not load sessions.
          </p>
        ) : (
          <Skeleton className="h-12" />
        )}
      </CardContent>
    </Card>
  )
}
