import { LocateFixed, Pause, Play, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { MapMarker, MapRoute, MarkerContent, useMap } from '@/components/ui/map'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useUploadHikes } from '@/features/hikes/useHikes'
import { LayeredMap } from '@/features/map/LayeredMap'
import { codeMessage, errorMessage } from '@/lib/errors'
import { formatClock, formatDate, formatDistance, formatElevation } from '@/lib/format'

import { useRecord, type Here } from './store'
import { toGpx, totals } from './track'

const TRACK_COLOR = '#e4572e'

/** Records the hike under way from the phone's GPS; the GPS itself runs in the layout. */
export function RecordPage() {
  const { t } = useTranslation()
  const status = useRecord((s) => s.status)
  const segments = useRecord((s) => s.segments)
  const here = useRecord((s) => s.here)
  const [follow, setFollow] = useState(true)
  const lines = useMemo(() => segments.filter((s) => s.length > 1).map((s) => s.map((f): [number, number] => [f.lon, f.lat])), [segments])

  return (
    <>
      <div className="absolute top-2 left-2 z-10">
        <SidebarTrigger className="bg-background shadow-sm" variant="outline" />
      </div>
      <LayeredMap className="size-full" center={here ? [here.lon, here.lat] : undefined} zoom={here ? 15 : 2}>
        {lines.map((line, i) => (
          <MapRoute key={i} id={`recorded-${i}`} coordinates={line} color={TRACK_COLOR} width={4} opacity={1} interactive={false} />
        ))}
        {here && <PositionMarker here={here} />}
        <FollowPosition here={here} follow={follow} setFollow={setFollow} />
        {!follow && here && (
          <Button size="icon" variant="outline" className="bg-background absolute right-2 bottom-44 z-10 shadow-sm" aria-label={t('record.follow')} onClick={() => setFollow(true)}>
            <LocateFixed />
          </Button>
        )}
      </LayeredMap>
      <div className="bg-background/95 absolute inset-x-2 bottom-2 z-10 space-y-3 rounded-xl border p-3 shadow-lg backdrop-blur">
        <RecordStats />
        <GpsStatus />
        <RecordButtons />
        {status !== 'idle' && <p className="text-muted-foreground text-center text-xs">{t('record.screenOn')}</p>}
      </div>
    </>
  )
}

function PositionMarker({ here }: { here: Here }) {
  return (
    <MapMarker longitude={here.lon} latitude={here.lat}>
      <MarkerContent>
        <span className="relative flex size-4">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-500 opacity-50" />
          <span className="relative inline-flex size-4 rounded-full border-2 border-white bg-sky-500 shadow-md" />
        </span>
      </MarkerContent>
    </MapMarker>
  )
}

/** Keeps the position in view until the map is dragged. */
function FollowPosition({ here, follow, setFollow }: { here: Here | null; follow: boolean; setFollow: (follow: boolean) => void }) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map) return
    const unfollow = () => setFollow(false)
    map.on('dragstart', unfollow)
    return () => void map.off('dragstart', unfollow)
  }, [map, setFollow])

  useEffect(() => {
    if (!map || !isLoaded || !follow || !here) return
    map.easeTo({ center: [here.lon, here.lat], zoom: Math.max(map.getZoom(), 15), duration: 500 })
  }, [map, isLoaded, follow, here])

  return null
}

/** Seconds since the start, minus pauses; ticks while recording. */
function useElapsedS() {
  const status = useRecord((s) => s.status)
  const segments = useRecord((s) => s.segments)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (status !== 'recording') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [status])

  const done = totals(segments.slice(0, -1)).durationS
  const first = segments[segments.length - 1]?.[0]
  const last = segments[segments.length - 1]?.at(-1)
  const current = !first ? 0 : status === 'recording' ? now - first.t : last!.t - first.t
  return done + Math.max(0, current) / 1000
}

function RecordStats() {
  const { t } = useTranslation()
  const segments = useRecord((s) => s.segments)
  const sum = useMemo(() => totals(segments), [segments])
  const elapsed = useElapsedS()

  return (
    <dl className="grid grid-cols-3 text-center">
      <Stat label={t('record.time')} value={formatClock(elapsed)} />
      <Stat label={t('record.distance')} value={formatDistance(sum.distanceM)} />
      <Stat label={t('record.gain')} value={formatElevation(sum.gainM)} />
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function GpsStatus() {
  const { t } = useTranslation()
  const here = useRecord((s) => s.here)
  const error = useRecord((s) => s.gpsError)
  if (error) return <p className="text-destructive text-center text-sm">{t(`record.gps.${error}`)}</p>
  return (
    <p className="text-muted-foreground text-center text-xs">
      {here ? t('record.gps.accuracy', { accuracy: Math.round(here.accuracyM) }) : t('record.gps.waiting')}
    </p>
  )
}

function RecordButtons() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { status, segments, startedAt, start, pause, resume, reset } = useRecord()
  const upload = useUploadHikes()
  const points = segments.reduce((n, s) => n + s.length, 0)

  function save() {
    const name = t('record.defaultName', { date: formatDate(new Date(startedAt ?? Date.now()).toISOString()) })
    const file = new File([toGpx(segments, name)], 'recording.gpx', { type: 'application/gpx+xml' })
    upload.mutate(
      { files: [file] },
      {
        onSuccess: ([result]) => {
          if (!result?.hike) {
            toast.error(codeMessage(result?.code, result?.params, t('record.saveFailed')))
            return
          }
          reset()
          navigate(`/hikes/${result.hike.id}`)
        },
        onError: (err) => toast.error(errorMessage(err, t('record.saveFailed'))),
      },
    )
  }

  if (status === 'idle') {
    return (
      <Button size="lg" className="w-full" onClick={start}>
        <Play />
        {t('record.start')}
      </Button>
    )
  }
  if (status === 'recording') {
    return (
      <Button size="lg" variant="secondary" className="w-full" onClick={pause}>
        <Pause />
        {t('record.pause')}
      </Button>
    )
  }
  return (
    <div className="flex gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="lg" variant="outline" aria-label={t('record.discard')} disabled={upload.isPending}>
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('record.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('record.discardBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={reset}>
              {t('record.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button size="lg" variant="secondary" className="flex-1" onClick={resume} disabled={upload.isPending}>
        <Play />
        {t('record.resume')}
      </Button>
      <Button size="lg" className="flex-1" onClick={save} disabled={upload.isPending || points < 2}>
        <Save />
        {upload.isPending ? t('common.saving') : t('record.save')}
      </Button>
    </div>
  )
}
