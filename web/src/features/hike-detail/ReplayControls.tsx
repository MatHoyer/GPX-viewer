import { Crosshair, Pause, Play, SkipBack } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import { formatClock, formatDistance } from '@/lib/format'

import { valueAt, type Profile } from './profile'
import { replaySpeeds, useReplay, visibleSpan } from './store'

export function ReplayControls({ profile }: { profile: Profile }) {
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
        <Button size="icon" onClick={() => s.setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button size="icon" variant="outline" onClick={() => s.setPos(lo)} aria-label="Back to start">
          <SkipBack />
        </Button>
        <Slider
          className="mx-2 flex-1"
          min={lo}
          max={hi}
          step={0.01}
          value={[Math.min(hi, Math.max(lo, pos))]}
          onValueChange={([v]) => s.setPos(v)}
          aria-label="Replay position"
        />
        <Select value={String(speed)} onValueChange={(v) => s.setSpeed(Number(v))}>
          <SelectTrigger size="sm" className="w-20" aria-label="Replay speed">
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
        <Toggle variant="outline" size="sm" pressed={follow} onPressedChange={s.setFollow} aria-label="Follow on map">
          <Crosshair />
        </Toggle>
      </div>
      <Readout profile={profile} pos={pos} />
    </div>
  )
}

function Readout({ profile, pos }: { profile: Profile; pos: number }) {
  const t = valueAt(profile.t, pos)
  const dist = valueAt(profile.dist, pos) ?? 0
  const ele = valueAt(profile.ele, pos)
  const speed = valueAt(profile.speed, pos)
  const hr = valueAt(profile.hr, pos)
  const items = [
    t !== null && { label: 'Time', value: formatClock(t) },
    { label: 'Distance', value: formatDistance(dist) },
    ele !== null && { label: 'Altitude', value: `${Math.round(ele)} m` },
    speed !== null && { label: 'Speed', value: `${(speed * 3.6).toFixed(1)} km/h` },
    hr !== null && { label: 'Heart rate', value: `${Math.round(hr)} bpm` },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="bg-muted/50 rounded-md px-2 py-1.5">
          <dt className="text-muted-foreground text-[10px] tracking-wide uppercase">{it.label}</dt>
          <dd className="text-sm font-semibold tabular-nums">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}
