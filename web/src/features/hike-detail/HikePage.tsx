import { ArrowLeft, Download, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import { useMe } from '@/features/auth/useAuth'
import { useDeleteHike } from '@/features/hikes/useHikes'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'

import { useHike, useProfile } from './api'
import { EditableTitle } from './EditableTitle'
import { HikeNotes } from './HikeNotes'
import { HikeStats } from './HikeStats'
import { Participants } from './Participants'
import { ProfileCharts } from './ProfileCharts'
import { RecordBadge } from './RecordBadge'
import { SameRoute } from './SameRoute'
import { ReplayControls } from './ReplayControls'
import { ReplayMap } from './ReplayMap'
import { useReplay } from './store'
import { useReplayClock } from './useReplayClock'

export function HikePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const me = useMe()
  const hike = useHike(id)
  const profile = useProfile(id)
  const deleteHike = useDeleteHike()
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Someone else's hike, shared with the viewer: read-only, credited to its owner.
  const ownerId = hike.data?.userId
  const isOwner = !!ownerId && ownerId === me.data?.id

  useEffect(() => {
    if (profile.data) useReplay.getState().reset(profile.data.lon.length, 'dist')
    return () => useReplay.getState().setPlaying(false)
  }, [profile.data])

  useReplayClock(profile.data)

  const notFound = [hike.error, profile.error].some((e) => e instanceof ApiError && e.status === 404)
  if (notFound) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-lg font-semibold">Hike not found</p>
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft /> Back to map
          </Link>
        </Button>
      </div>
    )
  }

  const date = formatDate(hike.data?.startedAt ?? null)

  return (
    <div className="bg-muted/30 min-h-svh">
      <header className="bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-3">
          {/* Return to whichever view (map or calendar) the hike was opened from. */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => {
              if (location.key !== 'default') navigate(-1)
              else navigate(ownerId && !isOwner ? `/u/${ownerId}` : '/')
            }}
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0 flex-1">
            {hike.data ? (
              <>
                {isOwner ? (
                  <EditableTitle hike={hike.data} />
                ) : (
                  <h1 className="truncate text-lg leading-tight font-semibold">{hike.data.name}</h1>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {date && <p className="text-muted-foreground text-sm">{date}</p>}
                  {!isOwner && hike.data.owner && (
                    <Link
                      to={`/u/${hike.data.userId}`}
                      className="text-muted-foreground flex items-center gap-1.5 text-sm hover:underline"
                    >
                      by
                      <UserAvatar user={hike.data.owner} className="size-5" />
                      <span className="text-foreground font-medium">{displayName(hike.data.owner)}</span>
                    </Link>
                  )}
                  <Participants hike={hike.data} isOwner={isOwner} viewerId={me.data?.id} />
                  {me.data && <RecordBadge hikeId={hike.data.id} />}
                </div>
              </>
            ) : (
              <Skeleton className="h-6 w-48" />
            )}
          </div>
          {hike.data && (
            <Button asChild variant="outline" size="icon" aria-label="Download GPX" title="Download GPX">
              <a href={`/api/hikes/${id}/gpx`} download>
                <Download />
              </a>
            </Button>
          )}
          {isOwner && (
            <Button variant="destructive" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Delete hike">
              <Trash2 />
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-4 p-4">
        {profile.data ? <HikeStats summary={profile.data.summary} /> : <Skeleton className="h-20 w-full" />}
        {hike.data && <HikeNotes hike={hike.data} isOwner={isOwner} />}
        {hike.data && me.data && <SameRoute hike={hike.data} />}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <section className="bg-card space-y-3 rounded-xl border p-3 lg:sticky lg:top-20 lg:self-start">
            <div className="h-[45vh] overflow-hidden rounded-lg lg:h-[calc(100svh-17rem)]">
              {profile.data ? <ReplayMap profile={profile.data} /> : <Skeleton className="size-full" />}
            </div>
            {profile.data && <ReplayControls profile={profile.data} />}
          </section>

          <section className="bg-card rounded-xl border p-4">
            {profile.data ? (
              <ProfileCharts profile={profile.data} />
            ) : (
              <div className="space-y-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this hike?</AlertDialogTitle>
            <AlertDialogDescription>“{hike.data?.name}” and its GPX file will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                deleteHike.mutate(id, {
                  onSuccess: () => {
                    toast.success('Hike deleted')
                    navigate('/', { replace: true })
                  },
                  onError: () => toast.error('Could not delete hike'),
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
