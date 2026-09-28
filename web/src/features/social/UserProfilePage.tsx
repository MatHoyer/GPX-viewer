import { ChevronRight, Clock, Link2, Lock, MoveUpRight, Pencil, Route, UsersRound } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import { useMe } from '@/features/auth/useAuth'
import { doneHikes, type Hike } from '@/features/hikes/api'
import { ESTIMATE_NOTE, estimatedDurationS } from '@/features/hikes/estimate'
import { HikesMapView } from '@/features/hikes/HikesMapView'
import { TaggedBy } from '@/features/hikes/TaggedBy'
import { ApiError } from '@/lib/api'
import { formatDate, formatDistance, formatDuration, formatElevation } from '@/lib/format'

import type { UserProfile } from './api'
import { FriendButton } from './FriendButton'
import { useUserHikes, useUserProfile, useUserTracks } from './useSocial'

export function UserProfilePage() {
  const { id = '' } = useParams()
  const me = useMe()
  const profile = useUserProfile(id)
  const canView = profile.data?.canView ?? false
  const hikes = useUserHikes(id, canView)
  const tracks = useUserTracks(id, canView)

  const notFound = profile.error instanceof ApiError && profile.error.status === 404
  const name = profile.data ? displayName(profile.data.user) : null

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        {/* Signed-out visitors get the page without the app sidebar. */}
        {me.data && <SidebarTrigger />}
        <h1 className="truncate text-lg font-semibold">{name ?? 'Profile'}</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        {notFound ? (
          <EmptyState icon={<Lock />} title="Profile not found">
            This profile does not exist, or its owner does not share it publicly.
          </EmptyState>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4 p-4">
            {profile.data ? <ProfileCard profile={profile.data} signedIn={!!me.data} /> : <Skeleton className="h-28" />}
            {profile.data &&
              (canView ? (
                <>
                  <Totals hikes={hikes.data} />
                  <Card className="gap-0 overflow-hidden py-0">
                    <div className="h-[45vh] min-h-72">
                      <HikesMapView hikes={hikes.data ?? []} tracks={tracks.data} userId={id} />
                    </div>
                  </Card>
                  <HikeList hikes={hikes.data} userId={id} />
                </>
              ) : (
                <HiddenNotice profile={profile.data} />
              ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ProfileCard({ profile, signedIn }: { profile: UserProfile; signedIn: boolean }) {
  const { user, relation, visibility } = profile

  function copyLink() {
    navigator.clipboard.writeText(`${location.origin}/u/${user.id}`).then(
      () => toast.success('Link copied'),
      () => toast.error('Could not copy link'),
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4">
        <UserAvatar user={user} className="size-16 sm:size-20" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xl font-semibold">{displayName(user)}</p>
          <p className="text-muted-foreground text-sm">Hiking since {formatDate(user.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2 max-sm:basis-full max-sm:[&>*]:flex-1">
          {visibility === 'public' && (
            <Button variant="outline" onClick={copyLink}>
              <Link2 />
              Copy link
            </Button>
          )}
          {relation === 'self' ? (
            <Button asChild variant="outline">
              <Link to="/settings">
                <Pencil />
                Edit profile
              </Link>
            </Button>
          ) : signedIn ? (
            <FriendButton userId={user.id} relation={relation} />
          ) : (
            <Button asChild>
              <Link to="/login">Sign in to add as friend</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function HiddenNotice({ profile }: { profile: UserProfile }) {
  const name = displayName(profile.user)
  if (profile.visibility === 'friends') {
    return (
      <EmptyState icon={<UsersRound />} title="Friends only">
        {profile.relation === 'outgoing'
          ? `Your friend request is waiting for ${name} to accept it.`
          : `Only ${name}'s friends can see their hikes.`}
      </EmptyState>
    )
  }
  return (
    <EmptyState icon={<Lock />} title="Private profile">
      {name} keeps their hikes to themselves.
    </EmptyState>
  )
}

function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground mx-auto flex max-w-sm flex-col items-center gap-2 px-4 py-16 text-center [&>svg]:size-8">
      {icon}
      <p className="text-foreground text-lg font-semibold">{title}</p>
      <p className="text-sm">{children}</p>
    </div>
  )
}

function Totals({ hikes }: { hikes: Hike[] | undefined }) {
  const totals = useMemo(() => {
    const list = doneHikes(hikes ?? [])
    return {
      count: list.length,
      distance: list.reduce((s, h) => s + h.distanceM, 0),
      elevation: list.reduce((s, h) => s + h.elevationGainM, 0),
    }
  }, [hikes])
  const loading = !hikes

  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-4">
      <Stat label="Hikes" value={loading ? '…' : String(totals.count)} />
      <Stat label="Distance" value={loading ? '…' : formatDistance(totals.distance)} />
      <Stat label="Elevation gain" value={loading ? '…' : formatElevation(totals.elevation)} />
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-xl border px-3 py-3 text-center">
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function HikeList({ hikes, userId }: { hikes: Hike[] | undefined; userId: string }) {
  if (hikes && hikes.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No hikes yet.</p>
  }
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Hikes</CardTitle>
      </CardHeader>
      <ul className="divide-y border-t">
        {hikes
          ? hikes.map((h) => (
              <li key={h.id}>
                <Link to={`/hikes/${h.id}`} className="hover:bg-muted/50 flex items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{h.name}</p>
                    <TaggedBy hike={h} userId={userId} link={false} />
                    <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs tabular-nums">
                      {h.startedAt && <span>{formatDate(h.startedAt)}</span>}
                      <span className="inline-flex items-center gap-1">
                        <Route className="size-3" />
                        {formatDistance(h.distanceM)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MoveUpRight className="size-3" />
                        {formatElevation(h.elevationGainM)}
                      </span>
                      {h.planned ? (
                        <span className="inline-flex items-center gap-1" title={ESTIMATE_NOTE}>
                          <Clock className="size-3" />~{formatDuration(estimatedDurationS(h.distanceM))}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDuration(h.durationS)}
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))
          : Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="px-6 py-3">
                <Skeleton className="h-9" />
              </li>
            ))}
      </ul>
    </Card>
  )
}
