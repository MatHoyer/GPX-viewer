import { Check, Copy } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import { useMe } from '@/features/auth/useAuth'
import { ApiError } from '@/lib/api'

import type { PublicUser, Relation } from './api'
import { FriendButton } from './FriendButton'
import { useConnections, useUserProfile } from './useSocial'

export function FriendsPage() {
  const { t } = useTranslation()
  const connections = useConnections()
  const data = connections.data

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">{t('nav.friends')}</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          <MyIdCard />
          <AddByIdCard />
          {data && data.incoming.length > 0 && (
            <PeopleCard title={t('friends.requests')} people={data.incoming} relation="incoming" />
          )}
          {data ? (
            <PeopleCard
              title={t('friends.count', { count: data.friends.length })}
              people={data.friends}
              relation="friends"
              empty={t('friends.none')}
            />
          ) : (
            <Skeleton className="h-40" />
          )}
          {data && data.outgoing.length > 0 && (
            <PeopleCard title={t('friends.sent')} people={data.outgoing} relation="outgoing" />
          )}
        </div>
      </main>
    </div>
  )
}

function MyIdCard() {
  const { t } = useTranslation()
  const me = useMe()
  const [copied, setCopied] = useState(false)
  const id = me.data?.id ?? ''

  function copy() {
    navigator.clipboard.writeText(id).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => toast.error(t('friends.copyFailed')),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('friends.yourId')}</CardTitle>
        <CardDescription>{t('friends.yourIdDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <code className="bg-muted min-w-0 flex-1 truncate rounded-md px-3 py-2 font-mono text-sm select-all">{id}</code>
        <Button variant="outline" onClick={copy} disabled={!id}>
          {copied ? <Check /> : <Copy />}
          {copied ? t('admin.copied') : t('admin.copy')}
        </Button>
      </CardContent>
    </Card>
  )
}

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** Looks up a user by the ID a friend shared, or by a pasted profile link. */
function AddByIdCard() {
  const { t } = useTranslation()
  const me = useMe()
  const [input, setInput] = useState('')
  const id = input.match(uuidPattern)?.[0].toLowerCase()
  const profile = useUserProfile(id && id !== me.data?.id ? id : undefined)

  let result: ReactNode = null
  if (id === me.data?.id) {
    result = <p className="text-muted-foreground text-sm">{t('friends.ownId')}</p>
  } else if (profile.error) {
    const notFound = profile.error instanceof ApiError && profile.error.status === 404
    result = (
      <p className="text-muted-foreground text-sm">{notFound ? t('friends.idNotFound') : t('friends.lookupFailed')}</p>
    )
  } else if (profile.data) {
    result = (
      <ul>
        <PersonRow user={profile.data.user}>
          <FriendButton userId={profile.data.user.id} relation={profile.data.relation} size="sm" />
        </PersonRow>
      </ul>
    )
  } else if (id) {
    result = <Skeleton className="h-9" />
  } else if (input.trim()) {
    result = <p className="text-muted-foreground text-sm">{t('friends.notAnId')}</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('friends.addTitle')}</CardTitle>
        <CardDescription>{t('friends.addDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FloatingInput
          label={t('friends.idLabel')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('friends.idPlaceholder')}
          spellCheck={false}
          autoComplete="off"
        />
        {result}
      </CardContent>
    </Card>
  )
}

type PeopleCardProps = {
  title: string
  people: PublicUser[]
  relation: Relation
  empty?: string
}

function PeopleCard({ title, people, relation, empty }: PeopleCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          <ul className="divide-y">
            {people.map((u) => (
              <PersonRow key={u.id} user={u}>
                <FriendButton userId={u.id} relation={relation} size="sm" showStatus={relation !== 'friends'} />
              </PersonRow>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function PersonRow({ user, children }: { user: PublicUser; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <Link to={`/u/${user.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
        <UserAvatar user={user} className="size-9" />
        <span className="truncate font-medium">{displayName(user)}</span>
      </Link>
      {children}
    </li>
  )
}
