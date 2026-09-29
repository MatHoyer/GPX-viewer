import { ArrowLeft, Download, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import { useMe } from '@/features/auth/useAuth'
import { PlannedBadge } from '@/features/hikes/PlannedBadge'
import { DeleteHikesDialog } from '@/features/hikes/DeleteHikesDialog'
import { useHikeSummits, useUpdateHike } from '@/features/hikes/useHikes'
import { CommentsPanel } from '@/features/interactions/CommentsPanel'
import { KudosButton } from '@/features/interactions/KudosButton'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'

import { useHike, useProfile } from './api'
import { EditableTitle } from './EditableTitle'
import { HikeSummits } from './HikeSummits'
import { LabelPicker } from './LabelPicker'
import { MarkDoneDialog } from './MarkDoneDialog'
import { NotesBlock } from './NotesBlock'
import { HikeStats } from './HikeStats'
import { Participants } from './Participants'
import { PlannedStart } from './PlannedStart'
import { ProfileCharts } from './ProfileCharts'
import { RecordBadge } from './RecordBadge'
import { SameRoute } from './SameRoute'
import { useTimeZone } from './timezone'
import { ReplayControls } from './ReplayControls'
import { ReplayMap } from './ReplayMap'
import { useReplay } from './store'
import { useReplayClock } from './useReplayClock'

export function HikePage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const me = useMe()
  const hike = useHike(id)
  const profile = useProfile(id)
  const summits = useHikeSummits(id)
  const update = useUpdateHike()
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Someone else's hike, shared with the viewer: read-only, credited to its owner.
  const ownerId = hike.data?.userId
  const isOwner = !!ownerId && ownerId === me.data?.id

  useEffect(() => {
    if (profile.data) useReplay.getState().reset(profile.data.lon.length, 'dist')
    return () => useReplay.getState().setPlaying(false)
  }, [profile.data])

  useReplayClock(profile.data)

  // Times read as on the trail, in the zone where the hike starts.
  const start = useMemo<[number, number] | undefined>(
    () => (profile.data && profile.data.lon.length > 0 ? [profile.data.lon[0], profile.data.lat[0]] : undefined),
    [profile.data],
  )
  const timeZone = useTimeZone(start)

  const notFound = [hike.error, profile.error].some((e) => e instanceof ApiError && e.status === 404)
  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-lg font-semibold">{t('hike.notFound')}</p>
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft /> {t('hike.backToMap')}
          </Link>
        </Button>
      </div>
    )
  }

  const date = formatDate(hike.data?.startedAt ?? null, timeZone)

  return (
    // The layout fixes the page height, so the page scrolls itself and the header sticks to its top.
    <div className="bg-muted/30 h-full overflow-y-auto">
      <header className="bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-3">
          {/* Signed-out visitors get the page without the app sidebar. */}
          {me.data && <SidebarTrigger />}
          {/* Return to whichever view (map or calendar) the hike was opened from. */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.back')}
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
                  {hike.data.planned && <PlannedBadge />}
                  {date && <p className="text-muted-foreground text-sm">{date}</p>}
                  {!isOwner && hike.data.owner && (
                    <Link
                      to={`/u/${hike.data.userId}`}
                      className="text-muted-foreground flex items-center gap-1.5 text-sm hover:underline"
                    >
                      {t('hike.by')}
                      <UserAvatar user={hike.data.owner} className="size-5" />
                      <span className="text-foreground font-medium">{displayName(hike.data.owner)}</span>
                    </Link>
                  )}
                  <Participants hike={hike.data} isOwner={isOwner} viewerId={me.data?.id} />
                  {me.data && <RecordBadge hikeId={hike.data.id} />}
                  <KudosButton hike={hike.data} viewerId={me.data?.id} />
                </div>
              </>
            ) : (
              <Skeleton className="h-6 w-48" />
            )}
          </div>
          {hike.data && (
            <Button asChild variant="outline" size="icon" aria-label={t('hikeActions.download')} title={t('hikeActions.download')}>
              <a href={`/api/hikes/${id}/gpx`} download>
                <Download />
              </a>
            </Button>
          )}
          {isOwner && hike.data?.planned && <MarkDoneDialog id={id} />}
          {isOwner && (
            <Button variant="destructive" size="icon" onClick={() => setConfirmDelete(true)} aria-label={t('hike.delete')}>
              <Trash2 />
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-4 p-4 pb-20">
        {profile.data ? <HikeStats
            summary={profile.data.summary}
            planned={hike.data?.planned}
            startedAt={hike.data?.startedAt}
            start={start}
            timeZone={timeZone}
          /> : <Skeleton className="h-20 w-full" />}
        {hike.data?.planned && profile.data && start && (
          <PlannedStart distanceM={profile.data.summary.distanceM} start={start} timeZone={timeZone} />
        )}
        {hike.data && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <LabelPicker
                labels={hike.data.labels}
                disabled={update.isPending}
                onChange={
                  isOwner
                    ? (labels) =>
                        update.mutate({ id, labels }, { onError: () => toast.error(t('labels.updateFailed')) })
                    : undefined
                }
              />
              {summits.data && <HikeSummits peaks={summits.data} />}
            </div>
            <NotesBlock hike={hike.data} isOwner={isOwner} />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <section className="bg-card space-y-3 rounded-xl border p-3 lg:sticky lg:top-20 lg:self-start">
            <div className="h-[45vh] overflow-hidden rounded-lg lg:h-[calc(100svh-17rem)]">
              {profile.data ? <ReplayMap profile={profile.data} peaks={summits.data} startedAt={hike.data?.planned ? null : hike.data?.startedAt} /> : <Skeleton className="size-full" />}
            </div>
            {profile.data && <ReplayControls profile={profile.data} startedAt={hike.data?.planned ? null : hike.data?.startedAt} timeZone={timeZone} />}
          </section>

          <section className="bg-card rounded-xl border p-4">
            {profile.data ? (
              <ProfileCharts profile={profile.data} startedAt={hike.data?.startedAt ?? null} />
            ) : (
              <div className="space-y-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            )}
          </section>
        </div>

        {hike.data && me.data && <SameRoute hike={hike.data} />}
      </main>
      {hike.data && <CommentsPanel hike={hike.data} viewerId={me.data?.id} />}

      <DeleteHikesDialog
        hikes={confirmDelete && hike.data ? [hike.data] : []}
        onClose={() => setConfirmDelete(false)}
        onDeleted={() => navigate('/', { replace: true })}
      />
    </div>
  )
}
