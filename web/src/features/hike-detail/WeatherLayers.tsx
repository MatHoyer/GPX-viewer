import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

import { MapRoute } from '@/components/ui/map'
import {
  conditionColors,
  conditionIcons,
  conditionLabel,
  conditionOf,
  conditionRuns,
  hourPlaces,
  type Condition,
  type HourPlace,
  type WeatherHour,
} from '@/features/hikes/weather'
import { formatNumber } from '@/lib/format'

import { linesBetween, type Profile } from './profile'

export type TrackWeather = { places: HourPlace[]; hours: WeatherHour[] }

export function useTrackWeather(profile: Profile, startedAt: string | null, hours: WeatherHour[] | undefined): TrackWeather | null {
  return useMemo(() => {
    const places = hourPlaces(profile.t, startedAt, hours)
    return places && hours ? { places, hours } : null
  }, [profile, startedAt, hours])
}

/** The weather at a fractional profile index. */
export function weatherAt(w: TrackWeather, f: number): WeatherHour {
  const p = w.places[Math.max(0, Math.min(w.places.length - 1, Math.round(f)))]
  return w.hours[p.k]
}

/** Halos under the track where it was walked in fog, rain, snow or a storm, with their legend. */
export function WeatherTrack({ profile, weather }: { profile: Profile; weather: TrackWeather }) {
  const runs = useMemo(() => conditionRuns(weather.places, weather.hours), [weather])
  const lines = useMemo(
    () => runs.flatMap((r) => linesBetween(profile, r.from, r.to).map((line) => ({ line, condition: r.condition }))),
    [profile, runs],
  )
  const present = [...new Set(runs.map((r) => r.condition))]
  return (
    <>
      {lines.map(({ line, condition }, i) => (
        <MapRoute
          key={i}
          id={`weather-${i}`}
          coordinates={line}
          color={conditionColors[condition]}
          width={11}
          opacity={0.7}
          beforeId="route-layer-track-0"
          interactive={false}
        />
      ))}
      {present.length > 0 && (
        <ul className="bg-background/85 absolute top-2 left-2 z-10 flex max-w-[calc(100%-4rem)] flex-wrap gap-x-3 gap-y-1 rounded-md border px-2 py-1 text-xs shadow-sm">
          {present.map((c) => (
            <li key={c} className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full" style={{ backgroundColor: conditionColors[c] }} />
              {conditionLabel(c)}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Icon and temperature shown above the replay head. */
export function WeatherBadge({ hour }: { hour: WeatherHour }) {
  const condition = conditionOf(hour.code)
  const Icon = conditionIcons[condition]
  return (
    <span className="bg-background/90 absolute bottom-full left-1/2 mb-1.5 flex -translate-x-1/2 items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums shadow">
      <Icon className="size-3.5" aria-label={conditionLabel(condition)} />
      {formatNumber(Math.round(hour.tempC))} °C
    </span>
  )
}

const reducedMotion = '(prefers-reduced-motion: reduce)'

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(reducedMotion)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(reducedMotion).matches,
  )
}

type Precip = { kind: 'rain' | 'snow' | null; count: number; slant: number; storm: boolean }

/** How much falls, and how the wind slants it, for an hour's weather. */
function precipOf(hour: WeatherHour | null): Precip {
  const condition: Condition | null = hour ? conditionOf(hour.code) : null
  const slant = hour ? Math.min(1, hour.windKmh / 40) : 0
  switch (condition) {
    case 'drizzle':
      return { kind: 'rain', count: 70, slant, storm: false }
    case 'rain':
      return { kind: 'rain', count: Math.min(260, 140 + hour!.precipMM * 30), slant, storm: false }
    case 'heavyRain':
      return { kind: 'rain', count: 380, slant, storm: false }
    case 'storm':
      return { kind: 'rain', count: 380, slant, storm: true }
    case 'snow':
      return { kind: 'snow', count: Math.min(260, 90 + hour!.snowCM * 80), slant, storm: false }
    default:
      return { kind: null, count: 0, slant, storm: false }
  }
}

/** How much a condition darkens the map. */
const gloom: Partial<Record<Condition, number>> = { rain: 0.08, heavyRain: 0.16, storm: 0.22, snow: 0.14 }

type Drop = { x: number; y: number; z: number; phase: number }

/**
 * Falling rain or snow over the map, as heavy as the weather at the replay
 * head, slanted by its wind; storms flash, fog hazes. Nothing moves for
 * people who ask for reduced motion.
 */
export function PrecipitationOverlay({ hour }: { hour: WeatherHour | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()
  const precip = precipOf(hour)
  const target = useRef(precip)
  useEffect(() => {
    target.current = precip
  })
  const condition = hour ? conditionOf(hour.code) : null
  const falling = precip.kind !== null && !reduced

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !falling) return
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      el.width = el.clientWidth * dpr
      el.height = el.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const resize = new ResizeObserver(fit)
    resize.observe(el)

    const drops: Drop[] = []
    const spawn = (w: number, h: number, top: boolean): Drop => ({
      x: Math.random() * w * 1.4 - w * 0.2,
      y: top ? -Math.random() * 40 : Math.random() * h,
      z: 0.4 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    })
    let flash = 0
    let last = performance.now()
    let frame = requestAnimationFrame(function draw(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { kind, count, slant, storm } = target.current
      const w = el.clientWidth
      const h = el.clientHeight
      // Ease toward the new amount as the head moves into or out of a shower.
      for (let n = 0; n < 4 && drops.length < count; n++) drops.push(spawn(w, h, false))
      if (drops.length > count) drops.splice(0, Math.min(4, drops.length - count))

      ctx.clearRect(0, 0, w, h)
      if (kind === 'rain') {
        ctx.strokeStyle = 'rgba(110, 140, 180, 0.55)'
        ctx.lineCap = 'round'
        ctx.beginPath()
        for (const d of drops) {
          const v = 700 * d.z
          d.y += v * dt
          d.x += v * slant * 0.35 * dt
          if (d.y > h) Object.assign(d, spawn(w, h, true))
          const len = 14 * d.z
          ctx.moveTo(d.x, d.y)
          ctx.lineTo(d.x - len * slant * 0.35, d.y - len)
        }
        ctx.lineWidth = 1.2
        ctx.stroke()
      } else if (kind === 'snow') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.lineWidth = 0.5
        for (const d of drops) {
          const v = 55 * d.z
          d.phase += dt * 1.5
          d.y += v * dt
          d.x += (Math.sin(d.phase) * 20 + v * slant) * dt
          if (d.y > h) Object.assign(d, spawn(w, h, true))
          ctx.beginPath()
          ctx.arc(d.x, d.y, 1.2 + 2.6 * d.z, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
      if (storm && flash <= 0 && Math.random() < dt / 5) flash = 1
      if (flash > 0) {
        // A bright strike that flickers as it fades.
        ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * flash * (0.6 + 0.4 * Math.random())})`
        ctx.fillRect(0, 0, w, h)
        flash -= dt * 3
      }
      frame = requestAnimationFrame(draw)
    })
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      ctx.clearRect(0, 0, el.width, el.height)
    }
  }, [falling])

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
      <div
        className="absolute inset-0 bg-slate-900 transition-opacity duration-700"
        style={{ opacity: (condition && gloom[condition]) ?? 0 }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-white/70 via-white/40 to-white/10 transition-opacity duration-700"
        style={{ opacity: condition === 'fog' ? 1 : 0 }}
      />
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  )
}
