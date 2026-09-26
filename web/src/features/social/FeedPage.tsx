import { useInfiniteQuery } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import { useMe } from '@/features/auth/useAuth'
import type { Hike } from '@/features/hikes/api'
import { KudosButton } from '@/features/interactions/KudosButton'
import { api } from '@/lib/api'
import { formatDate, formatDistance, formatDuration, formatElevation } from '@/lib/format'

type FeedPage = { hikes: Hike[]; next: string | null }

function useFeed() {
  return useInfiniteQuery({
    queryKey: ['hikes', 'feed'],
    queryFn: ({ pageParam }) => api<FeedPage>(pageParam ? `/feed?after=${encodeURIComponent(pageParam)}` : '/feed'),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  })
}

/** Friends' recent hikes and the ones you were tagged on, newest first. */
export function FeedPage() {
  const feed = useFeed()
  const me = useMe()
  const hikes = feed.data?.pages.flatMap((p) => p.hikes) ?? []

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">Activity</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-3 p-4">
          {feed.isLoading ? (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28 w-full" />)
          ) : hikes.length === 0 ? (
            <div className="text-muted-foreground space-y-2 py-12 text-center text-sm">
              <p>Nothing here yet.</p>
              <p>
                Hikes from <Link to="/friends" className="text-foreground underline">friends</Link> who share them, and the ones
                you are tagged on, show up here.
              </p>
            </div>
          ) : (
            <>
              {hikes.map((h) => (
                <FeedCard key={h.id} hike={h} viewerId={me.data?.id} />
              ))}
              {feed.hasNextPage && (
                <Button variant="outline" className="w-full" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                  {feed.isFetchingNextPage ? 'Loading…' : 'Show more'}
                </Button>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function FeedCard({ hike, viewerId }: { hike: Hike; viewerId: string | undefined }) {
  const others = (hike.participants ?? []).filter((p) => p.id !== viewerId)
  const taggedMe = hike.participants?.some((p) => p.id === viewerId) ?? false
  const stats = [
    formatDistance(hike.distanceM),
    `${formatElevation(hike.elevationGainM)} D+`,
    hike.durationS > 0 ? formatDuration(hike.movingS ?? hike.durationS) : null,
  ].filter(Boolean)

  return (
    <article className="bg-card space-y-2 rounded-xl border p-4">
      {hike.owner && (
        <div className="flex items-center gap-2 text-sm">
          <Link to={`/u/${hike.owner.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
            <UserAvatar user={hike.owner} className="size-7" />
            <span className="truncate font-medium">{displayName(hike.owner)}</span>
          </Link>
          <span className="text-muted-foreground ml-auto shrink-0 text-xs">{formatDate(hike.startedAt ?? hike.createdAt)}</span>
        </div>
      )}
      <Link to={`/hikes/${hike.id}`} className="block text-base font-semibold hover:underline">
        {hike.name}
      </Link>
      <p className="text-muted-foreground text-sm tabular-nums">{stats.join(' · ')}</p>
      {(taggedMe || others.length > 0) && (
        <p className="text-muted-foreground text-xs">
          {taggedMe ? 'With you' : 'With'}
          {others.length > 0 && `${taggedMe ? ', ' : ' '}${others.map(displayName).join(', ')}`}
        </p>
      )}
      <div className="flex items-center gap-3 pt-1">
        <KudosButton hike={hike} viewerId={viewerId} />
        <Link to={`/hikes/${hike.id}#comments`} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
          <MessageCircle className="size-4" />
          {hike.interactions?.comments ? hike.interactions.comments : 'Comment'}
        </Link>
      </div>
      {hike.labels.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {hike.labels.map((l) => (
            <li key={l} className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              {l}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
