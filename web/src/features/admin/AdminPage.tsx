import { ChevronLeft, ChevronRight, Search, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import { useConfig, useMe } from '@/features/auth/useAuth'
import { formatDate, formatRelative } from '@/lib/format'

import type { AdminUser } from './api'
import { InviteDialog } from './InviteDialog'
import { Pill, UserPills } from './Pill'
import { useUsers } from './useAdmin'

export function AdminPage() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">{t('nav.admin')}</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          <RegistrationCard />
          <EmailCard />
          <UsersCard />
        </div>
      </main>
    </div>
  )
}

/** Read-only: the environment is the source of truth. */
function RegistrationCard() {
  const { t } = useTranslation()
  const config = useConfig()
  const enabled = config.data?.registrationEnabled

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.registration')}</CardTitle>
        <CardDescription>
          <Trans i18nKey="admin.registrationDescription" components={{ code: <code className="font-mono" /> }} />
        </CardDescription>
        <CardAction>
          {enabled === undefined ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <Pill tone={enabled ? 'good' : 'muted'}>{enabled ? t('admin.openToAll') : t('admin.inviteOnly')}</Pill>
          )}
        </CardAction>
      </CardHeader>
      {enabled === false && (
        <CardContent className="text-muted-foreground text-sm">
          {t('admin.inviteOnlyHint')}
        </CardContent>
      )}
    </Card>
  )
}

/** Read-only: whether SMTP is set up, and what that changes. */
function EmailCard() {
  const { t } = useTranslation()
  const config = useConfig()
  const enabled = config.data?.emailEnabled

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('common.email')}</CardTitle>
        <CardDescription>
          {enabled === false ? t('admin.emailOff') : t('admin.emailOn')}
        </CardDescription>
        <CardAction>
          {enabled === undefined ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <Pill tone={enabled ? 'good' : 'muted'}>{enabled ? t('admin.configured') : t('admin.notConfigured')}</Pill>
          )}
        </CardAction>
      </CardHeader>
    </Card>
  )
}

/** Users, a page at a time; the search and page live in the URL so going back keeps them. */
function UsersCard() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [search, setSearch] = useState(q)
  const [inviting, setInviting] = useState(false)
  const users = useUsers(q, page)
  const data = users.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  // Searching resets to the first page.
  useEffect(() => {
    const next = search.trim()
    if (next === q) return
    const timer = setTimeout(() => setParams(next ? { q: next } : {}, { replace: true }), 300)
    return () => clearTimeout(timer)
  }, [search, q, setParams])

  function goTo(p: number) {
    const next = new URLSearchParams(params)
    if (p > 1) next.set('page', String(p))
    else next.delete('page')
    setParams(next)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('admin.users')}
          {data && ` (${data.total})`}
        </CardTitle>
        <CardAction>
          <Button size="sm" onClick={() => setInviting(true)}>
            <UserPlus />
            {t('admin.invite')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <FloatingInput
          type="search"
          label={t('admin.search')}
          icon={<Search />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {data ? (
          data.users.length > 0 ? (
            <ul className={users.isPlaceholderData ? 'opacity-60' : undefined}>
              {data.users.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {q ? t('admin.noMatch', { q }) : t('admin.noUsers')}
            </p>
          )
        ) : users.isError ? (
          <p role="alert" className="text-destructive text-sm">
            {t('admin.loadFailed')}
          </p>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}
      </CardContent>
      {data && pages > 1 && (
        <CardFooter className="justify-between">
          <span className="text-muted-foreground text-sm">
            {t('admin.range', {
              from: (page - 1) * data.pageSize + 1,
              to: Math.min(page * data.pageSize, data.total),
              total: data.total,
            })}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" aria-label={t('admin.previousPage')} disabled={page <= 1} onClick={() => goTo(page - 1)}>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('admin.nextPage')}
              disabled={page >= pages}
              onClick={() => goTo(page + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </CardFooter>
      )}
      <InviteDialog open={inviting} onOpenChange={setInviting} />
    </Card>
  )
}

function UserRow({ user }: { user: AdminUser }) {
  const { t } = useTranslation()
  const me = useMe()
  const meta = [
    t('admin.joined', { date: formatDate(user.createdAt) }),
    user.lastSeenAt && t('sessions.active', { when: formatRelative(user.lastSeenAt) }),
    t('admin.hikeCount', { count: user.hikes }),
  ].filter(Boolean)

  return (
    <li>
      <Link
        to={`/admin/users/${user.id}`}
        className="hover:bg-muted/60 -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors"
      >
        <UserAvatar user={user} className="mt-0.5 size-9" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{displayName(user)}</span>
            {me.data?.id === user.id && <span className="text-muted-foreground text-xs">{t('admin.you')}</span>}
            <UserPills user={user} />
          </div>
          <p className="text-muted-foreground truncate text-sm">{user.email}</p>
          <p className="text-muted-foreground text-xs">{meta.join(' · ')}</p>
        </div>
        <ChevronRight className="text-muted-foreground mt-2 size-4 shrink-0" aria-hidden />
      </Link>
    </li>
  )
}
