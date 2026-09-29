import { Crosshair, Moon, Pause, Play, SkipBack, Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import { formatClock, formatDistance, formatElevation, formatNumber, formatTime } from '@/lib/format'

import { valueAt, type Profile } from './profile'
import { replaySpeeds, useReplay, visibleSpan } from './store'
import { sunAtIndex, type SunPosition } from './sun'

/** startedAt turns the replay's elapsed time into the time of day. */
export function ReplayControls({
  profile,
  startedAt = null,
  timeZone,
}: {
  profile: Profile
  startedAt?: string | null
  /** The hike's own time zone, for the time of day; the viewer's when undefined. */
  timeZone?: string
}) {
  const { t } = useTranslation()
  const playing = useReplay((s) => s.playing)
  const pos = useReplay((s) => s.pos)
  const range = useReplay((s) => s.range)
  const count = useReplay((s) => s.count)
  const speed = useReplay((s) => s.speed)
  const follow = useReplay((s) => s.follow)
  const [lo, hi] = visibleSpan({ range, count })

  // Space toggles playback unless typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (e.code !== 'Space' || target.closest('input, textarea, [role=slider], button, [role=combobox]')) return
      e.preventDefault()
      const s = useReplay.getState()
      s.setPlaying(!s.playing)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const s = useReplay.getState()
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="icon" onClick={() => s.setPlaying(!playing)} aria-label={playing ? t('replay.pause') : t('replay.play')}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button size="icon" variant="outline" onClick={() => s.setPos(lo)} aria-label={t('replay.backToStart')}>
          <SkipBack />
        </Button>
        <Slider
          className="mx-2 flex-1"
          min={lo}
          max={hi}
          step={0.01}
          value={[Math.min(hi, Math.max(lo, pos))]}
          onValueChange={([v]) => s.setPos(v)}
          aria-label={t('replay.position')}
        />
        <Select value={String(speed)} onValueChange={(v) => s.setSpeed(Number(v))}>
          <SelectTrigger size="sm" className="w-20" aria-label={t('replay.speed')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {replaySpeeds.map((v) => (
              <SelectItem key={v} value={String(v)}>
                ×{v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Toggle variant="outline" size="sm" pressed={follow} onPressedChange={s.setFollow} aria-label={t('replay.follow')}>
          <Crosshair />
        </Toggle>
      </div>
      <Readout profile={profile} pos={pos} startedAt={startedAt} timeZone={timeZone} />
    </div>
  )
}

type Item = { label: string; value: string; icon?: LucideIcon }

/** Sun up, near the horizon (golden hour and twilight, rising or setting), or night. */
function sunIcon({ altitude, rising }: SunPosition): LucideIcon {
  if (altitude > 6) return Sun
  if (altitude <= -6) return Moon
  return rising ? Sunrise : Sunset
}

function Readout({
  profile,
  pos,
  startedAt,
  timeZone,
}: {
  profile: Profile
  pos: number
  startedAt: string | null
  timeZone?: string
}) {
  const { t } = useTranslation()
  const elapsed = valueAt(profile.t, pos)
  const sun = sunAtIndex(profile, startedAt, pos)
  const dist = valueAt(profile.dist, pos) ?? 0
  const ele = valueAt(profile.ele, pos)
  const speed = valueAt(profile.speed, pos)
  const hr = valueAt(profile.hr, pos)
  const items = [
    elapsed !== null &&
      startedAt && {
        label: t('replay.timeOfDay'),
        value: formatTime(new Date(new Date(startedAt).getTime() + elapsed * 1000), timeZone),
        icon: sun ? sunIcon(sun) : undefined,
      },
    elapsed !== null && { label: t('replay.elapsed'), value: formatClock(elapsed) },
    { label: t('hike.distance'), value: formatDistance(dist) },
    ele !== null && { label: t('replay.altitude'), value: formatElevation(ele) },
    speed !== null && {
      label: t('series.speed'),
      value: `${formatNumber(speed * 3.6, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/h`,
    },
    hr !== null && { label: t('stat.heartRate'), value: `${Math.round(hr)} bpm` },
  ].filter(Boolean) as Item[]

  return (
    <dl className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]">
      {items.map((it) => (
        <div key={it.label} className="bg-muted/50 rounded-md px-2 py-1.5">
          <dt className="text-muted-foreground text-[10px] tracking-wide uppercase">{it.label}</dt>
          <dd className="flex items-center gap-1 text-sm font-semibold tabular-nums">
            {it.icon && <it.icon className="text-muted-foreground size-3.5" aria-hidden />}
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
