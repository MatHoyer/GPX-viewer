import { Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'

import { MIN_SEARCH_LENGTH, type PublicUser, type Relation } from './api'
import { FriendButton } from './FriendButton'
import { useConnections, useUserSearch } from './useSocial'

export function FriendsPage() {
  const connections = useConnections()
  const data = connections.data

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">Friends</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          <FindCard relationOf={(id) => relationOf(data, id)} />
          {data && data.incoming.length > 0 && (
            <PeopleCard title="Friend requests" people={data.incoming} relation="incoming" />
          )}
          {data ? (
            <PeopleCard
              title={`Friends (${data.friends.length})`}
              people={data.friends}
              relation="friends"
              empty="No friends yet. Find hikers by name, or by email if their profile is private."
            />
          ) : (
            <Skeleton className="h-40" />
          )}
          {data && data.outgoing.length > 0 && (
            <PeopleCard title="Sent requests" people={data.outgoing} relation="outgoing" />
          )}
        </div>
      </main>
    </div>
  )
}

function relationOf(data: ReturnType<typeof useConnections>['data'], id: string): Relation {
  if (data?.friends.some((u) => u.id === id)) return 'friends'
  if (data?.incoming.some((u) => u.id === id)) return 'incoming'
  if (data?.outgoing.some((u) => u.id === id)) return 'outgoing'
  return 'none'
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function FindCard({ relationOf }: { relationOf: (id: string) => Relation }) {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 300)
  const results = useUserSearch(q)
  const searching = q.length >= MIN_SEARCH_LENGTH

  return (
    <Card>
      <CardHeader>
        <CardTitle>Find hikers</CardTitle>
        <CardDescription>Search by name, or by exact email address.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or email"
            aria-label="Search hikers"
            className="pl-8"
          />
        </div>
        {searching &&
          (results.data?.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-sm">No hikers found.</p>
          ) : (
            <ul className="divide-y">
              {results.data?.map((u) => (
                <PersonRow key={u.id} user={u}>
                  <FriendButton userId={u.id} relation={relationOf(u.id)} size="sm" />
                </PersonRow>
              ))}
            </ul>
          ))}
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
                <FriendButton userId={u.id} relation={relation} size="sm" />
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
