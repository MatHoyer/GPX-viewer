import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
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
import { errorMessage } from '@/lib/errors'
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

const onError = (fallback: string) => (err: Error) => toast.error(errorMessage(err, fallback))

/** One user as an admin sees them: account details, what can be done to it, and its sessions. */
export function AdminUserPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const user = useUser(id)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <Button asChild variant="ghost" size="icon" aria-label={t('admin.backToUsers')}>
          <Link to="/admin">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="truncate text-lg font-semibold">{user.data ? displayName(user.data) : t('admin.user')}</h1>
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
                ? t('admin.userGone')
                : t('admin.userLoadFailed')}
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
  const { t } = useTranslation()
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
              {t('nav.profile')}
              <ExternalLink />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {user.bannedAt && (
          <p className="bg-destructive/10 text-destructive mb-4 rounded-lg px-3 py-2 text-sm break-words">
            {t('admin.bannedOn', { date: formatDate(user.bannedAt), reason: user.banReason })}
          </p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          <Fact label={t('admin.factJoined')}>{formatDate(user.createdAt)}</Fact>
          <Fact label={t('admin.factEmailConfirmed')}>{formatDate(user.emailVerifiedAt) ?? t('admin.notYet')}</Fact>
          <Fact label={t('admin.factLastActive')}>
            {user.lastSeenAt ? formatRelative(user.lastSeenAt) : t('admin.notSignedIn')}
          </Fact>
          <Fact label={t('nav.hikes')}>{user.hikes}</Fact>
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
  const { t } = useTranslation()
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
          <CardTitle>{t('admin.actions')}</CardTitle>
          <CardDescription>{t('admin.actionsSelf')}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const pending = user.invitedAt !== null
  const verified = user.emailVerifiedAt !== null
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.actions')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {!user.bannedAt && (
          <Button variant="outline" onClick={() => setDialog('reinvite')}>
            {pending ? t('admin.newInviteLink') : t('admin.passwordLink')}
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
                  onSuccess: () => toast.success(verified ? t('admin.markedUnverified') : t('admin.markedVerified')),
                  onError: onError(t('admin.emailStatusFailed')),
                },
              )
            }
          >
            {verified ? t('admin.markUnverified') : t('admin.markVerified')}
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
                    toast.success(user.isAdmin ? t('admin.noLongerAdmin', { name }) : t('admin.nowAdmin', { name })),
                  onError: onError(t('admin.roleFailed')),
                },
              )
            }
          >
            {user.isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
          </Button>
        )}
        {!user.isAdmin &&
          (user.bannedAt ? (
            <Button
              variant="outline"
              disabled={unban.isPending}
              onClick={() =>
                unban.mutate(user.id, {
                  onSuccess: () => toast.success(t('admin.unbanned', { name })),
                  onError: onError(t('admin.unbanFailed')),
                })
              }
            >
              {t('admin.liftBan')}
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setDialog('ban')}>
              {t('admin.banEllipsis')}
            </Button>
          ))}
        {pending && user.hikes === 0 && (
          <Button variant="destructive" onClick={() => setDialog('revoke')}>
            {t('admin.revokeEllipsis')}
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
  const { t } = useTranslation()
  const me = useMe()
  const sessions = useUserSessions(user.id)
  const revoke = useRevokeUserSession()
  const revokeAll = useRevokeUserSessions()
  const self = me.data?.id === user.id

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.sessions')}</CardTitle>
        <CardDescription>
          {self ? (
            <Trans
              i18nKey="admin.sessionsSelf"
              components={{ settings: <Link to="/settings/security" className="text-foreground underline underline-offset-4" /> }}
            />
          ) : (
            t('admin.sessionsDescription')
          )}
        </CardDescription>
        {!self && sessions.data && sessions.data.length > 0 && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={revokeAll.isPending}
              onClick={() =>
                revokeAll.mutate(user.id, {
                  onSuccess: () => toast.success(t('admin.signedOutEverywhere', { name: displayName(user) })),
                  onError: onError(t('admin.signOutFailed')),
                })
              }
            >
              {t('admin.signOutEverywhere')}
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
                : (s) => revoke.mutate({ userId: user.id, id: s.id }, { onError: onError(t('sessions.signOutFailed')) })
            }
          />
        ) : sessions.isError ? (
          <p role="alert" className="text-destructive text-sm">
            {t('admin.sessionsLoadFailed')}
          </p>
        ) : (
          <Skeleton className="h-12" />
        )}
      </CardContent>
    </Card>
  )
}
