import { ChevronLeft, ChevronRight, Search, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

/** Users, a page at a time; the search and page live in the URL so going back keeps them. */
function UsersCard() {
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
    const t = setTimeout(() => setParams(next ? { q: next } : {}, { replace: true }), 300)
    return () => clearTimeout(t)
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
        <CardTitle>Users{data && ` (${data.total})`}</CardTitle>
        <CardAction>
          <Button size="sm" onClick={() => setInviting(true)}>
            <UserPlus />
            Invite
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Search by email or name"
            aria-label="Search users"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {data ? (
          data.users.length > 0 ? (
            <ul className={users.isPlaceholderData ? 'opacity-60' : undefined}>
              {data.users.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {q ? `No user matches "${q}".` : 'No users yet.'}
            </p>
          )
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
      {data && pages > 1 && (
        <CardFooter className="justify-between">
          <span className="text-muted-foreground text-sm">
            {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => goTo(page - 1)}>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
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
  const me = useMe()
  const meta = [
    `Joined ${formatDate(user.createdAt)}`,
    user.lastSeenAt && `active ${formatRelative(user.lastSeenAt)}`,
    `${user.hikes} ${user.hikes === 1 ? 'hike' : 'hikes'}`,
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
            {me.data?.id === user.id && <span className="text-muted-foreground text-xs">(you)</span>}
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
