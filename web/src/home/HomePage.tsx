import { Blobatar } from '@blobatar/react'
import { Activity, Gauge, Mountain, MountainSnow, Pause, Thermometer, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'

import { ascent, contours, featured, others, sampleTrack, toPath, type Sample } from './terrain'

// Same palette as the app's map (features/hikes/colors.ts).
const trackColors = ['#2e86ab', '#8cb369', '#9c6ade', '#f4a259']

const MAP_W = 1600
const MAP_H = 1000

const samples = sampleTrack(featured)
const totalKm = samples[samples.length - 1].km
const summit = samples.reduce((a, b) => (b.ele > a.ele ? b : a))
const summitPt = featured[samples.indexOf(summit)]
const movingHours = samples.reduce(
  (t, s, k) => (k === 0 ? 0 : t + (s.km - samples[k - 1].km) / s.speed),
  0,
)

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const km = (n: number) => `${n.toFixed(1)} km`
const m = (n: number) => `${nf.format(n)} m`
const duration = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

export function HomePage() {
  return (
    <div className="bg-paper text-ink font-sans antialiased">
      <Header />
      <main>
        <Hero />
        <HikeDetail />
        <Season />
        <Together />
        <Details />
        <Closing />
      </main>
      <Footer />
    </div>
  )
}

function Header() {
  return (
    <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
      <a href="/" className="flex items-center gap-2 rounded-md font-display text-lg font-bold tracking-tight">
        <MountainSnow className="text-trail size-6" aria-hidden />
        GPX Viewer
      </a>
      <nav className="flex items-center gap-1 text-sm font-medium" aria-label="Account">
        <a href="/login" className="hover:bg-ink/5 rounded-full px-3 py-2">
          Sign in
        </a>
        <a href="/register" className="bg-ink text-paper hover:bg-ink/85 rounded-full px-4 py-2">
          Create account
        </a>
      </nav>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative -mt-[68px] overflow-hidden md:min-h-[min(820px,100svh)]">
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-4 pt-28 sm:px-8 md:min-h-[min(820px,100svh)] md:justify-center md:pt-24 md:pb-40">
        <h1 className="font-display max-w-[11ch] text-[clamp(2.75rem,7.5vw,6.25rem)] leading-[0.92] font-bold tracking-[-0.035em] text-balance">
          Every hike you've recorded, on one map.
        </h1>
        <p className="text-ink-soft mt-6 max-w-[34rem] text-lg leading-relaxed text-pretty">
          Import the GPX files from your watch or phone. GPX Viewer draws all your trails together, then lets you open
          any one to see how the climb really went.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href="/register" className="bg-trail hover:bg-trail/90 rounded-full px-6 py-3 font-semibold text-white">
            Create an account
          </a>
          <a href="/login" className="hover:bg-ink/5 rounded-full px-5 py-3 font-medium">
            Sign in
          </a>
        </div>
      </div>

      <div className="relative mt-10 aspect-square sm:aspect-[4/3] md:absolute md:inset-0 md:mt-0 md:aspect-auto">
        <TopoMap />
        {/* Keeps the headline legible where it overlaps the map. */}
        <div className="from-paper via-paper/80 pointer-events-none absolute inset-0 hidden bg-gradient-to-r via-30% to-transparent to-55% md:block" />
        <div className="from-paper pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent md:h-32" />
        <HikeLabel />
      </div>
    </section>
  )
}

const contourPaths = contours(MAP_W, MAP_H, 110, 70, 24)

function TopoMap() {
  const d = toPath(featured, MAP_W, MAP_H)
  const sx = summitPt[0] * MAP_W
  const sy = summitPt[1] * MAP_H
  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMaxYMid slice"
      className="absolute inset-0 size-full"
      role="img"
      aria-label="Topographic map with five hiking tracks, one highlighted crossing the main summit"
    >
      <g fill="none" stroke="var(--contour)" strokeLinecap="round" strokeLinejoin="round">
        {contourPaths.map((c, k) => (
          <path key={k} d={c.d} strokeWidth={c.index ? 1.8 : 0.9} opacity={c.index ? 0.9 : 0.55} />
        ))}
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {others.map((t, k) => (
          <path key={k} d={toPath(t, MAP_W, MAP_H)} stroke={trackColors[k]} strokeWidth={4} opacity={0.85} />
        ))}
        <path d={d} stroke="var(--paper)" strokeWidth={11} />
        <path className="draw-track" d={d} pathLength={1} stroke="var(--trail)" strokeWidth={6} />
      </g>
      <g className="summit-label" transform={`translate(${sx} ${sy})`}>
        <path d="M0 -9 L8 5 L-8 5 Z" fill="var(--ink)" />
        <text x={14} y={5} className="font-display" fontSize={22} fontWeight={700} fill="var(--ink)">
          {nf.format(summit.ele)}
        </text>
      </g>
    </svg>
  )
}

function HikeLabel() {
  return (
    <div className="summit-label bg-paper/90 absolute right-4 bottom-4 rounded-2xl px-4 py-3 shadow-[0_1px_0_var(--line),0_12px_32px_-12px_rgb(28_42_34/0.35)] backdrop-blur sm:right-8 sm:bottom-8">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="bg-trail size-2.5 rounded-full" aria-hidden />
        Pointe de la Combe
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-x-5 text-sm">
        <Stat label="Distance" value={km(totalKm)} />
        <Stat label="Ascent" value={m(ascent(samples))} />
        <Stat label="Moving" value={duration(movingHours)} />
      </dl>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-soft text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function Section({ title, children, aside, flip }: { title: string; children: ReactNode; aside: ReactNode; flip?: boolean }) {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-8 md:grid-cols-12 md:gap-12 md:py-20">
      <div className={flip ? 'md:order-2 md:col-span-5 md:col-start-8' : 'md:col-span-5'}>
        <h2 className="font-display text-[clamp(2rem,4vw,3.25rem)] leading-[1] font-bold tracking-[-0.03em] text-balance">
          {title}
        </h2>
        <div className="text-ink-soft mt-5 space-y-4 text-lg leading-relaxed text-pretty">{children}</div>
      </div>
      <div className={flip ? 'md:order-1 md:col-span-7' : 'md:col-span-6 md:col-start-7'}>{aside}</div>
    </section>
  )
}

function HikeDetail() {
  return (
    <Section
      title="Open a hike to see how it went"
      aside={<ProfilePanel />}
    >
      <p>
        Elevation, speed, heart rate, cadence and temperature, charted along the trail from whatever your device
        recorded.
      </p>
      <p>
        Drag across a chart to measure one climb. Press play to replay the hike on the map up to 600 times faster than real time.
      </p>
    </Section>
  )
}

const CH_W = 640
const CH_H = 220

function ProfilePanel() {
  const minE = 600
  const maxE = 3100
  const x = (s: Sample) => (s.km / totalKm) * CH_W
  const yE = (e: number) => CH_H - ((e - minE) / (maxE - minE)) * CH_H
  const yHr = (hr: number) => CH_H - ((hr - 80) / (190 - 80)) * CH_H
  const line = samples.map((s) => `${x(s).toFixed(1)} ${yE(s.ele).toFixed(1)}`).join('L')
  const area = `M0 ${CH_H}L${line}L${CH_W} ${CH_H}Z`
  const hr = `M${samples.map((s) => `${x(s).toFixed(1)} ${yHr(s.hr).toFixed(1)}`).join('L')}`

  // The steepest stretch of the ascent, as if someone had brushed it.
  const peak = samples.indexOf(summit)
  const from = Math.round(peak * 0.42)
  const range = samples.slice(from, peak + 1)
  const gain = ascent(range)
  const rangeKm = range[range.length - 1].km - range[0].km
  const bx0 = x(range[0])
  const bx1 = x(range[range.length - 1])
  const head = samples[Math.round(samples.length * 0.72)]

  return (
    <figure className="border-line bg-paper-2 rounded-[28px] border p-5 sm:p-7">
      <figcaption className="sr-only">Elevation and heart rate profile of a hike, with a climb selected</figcaption>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <PanelStat icon={<Activity />} label="Distance" value={km(totalKm)} />
        <PanelStat icon={<TrendingUp />} label="Ascent" value={m(ascent(samples))} />
        <PanelStat icon={<Mountain />} label="Highest point" value={m(summit.ele)} />
        <PanelStat icon={<Gauge />} label="Moving time" value={duration(movingHours)} />
      </dl>
      <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
        <SeriesChip color="var(--ele)" label="Elevation" on />
        <SeriesChip color="var(--hr)" label="Heart rate" on />
        <SeriesChip color="var(--speed)" label="Speed" />
        <SeriesChip color="var(--cad)" label="Cadence" />
        <SeriesChip color="var(--temp)" label="Temperature" icon={<Thermometer className="size-3" />} />
      </div>
      <div className="relative mt-4">
        <svg viewBox={`0 0 ${CH_W} ${CH_H}`} className="block h-auto w-full overflow-visible" aria-hidden>
          {[1000, 1500, 2000, 2500, 3000].map((e) => (
            <line key={e} x1={0} x2={CH_W} y1={yE(e)} y2={yE(e)} stroke="var(--line)" />
          ))}
          <rect x={bx0} y={0} width={bx1 - bx0} height={CH_H} fill="var(--ink)" opacity={0.06} />
          <line x1={bx0} x2={bx0} y1={0} y2={CH_H} stroke="var(--ink)" strokeOpacity={0.35} />
          <line x1={bx1} x2={bx1} y1={0} y2={CH_H} stroke="var(--ink)" strokeOpacity={0.35} />
          <path d={area} fill="var(--ele)" opacity={0.22} />
          <path d={`M${line}`} fill="none" stroke="var(--ele)" strokeWidth={2} />
          <path d={hr} fill="none" stroke="var(--hr)" strokeWidth={1.5} />
          <line x1={x(head)} x2={x(head)} y1={0} y2={CH_H} stroke="var(--trail)" strokeWidth={1.5} />
          <circle cx={x(head)} cy={yE(head.ele)} r={5} fill="var(--trail)" stroke="var(--paper-2)" strokeWidth={2} />
        </svg>
        <div
          className="bg-ink text-paper absolute -top-3 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap tabular-nums"
          style={{ left: `${((bx0 + bx1) / 2 / CH_W) * 100}%`, transform: 'translateX(-50%)' }}
        >
          +{m(gain)} in {km(rangeKm)}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3 text-sm">
        <span className="bg-ink text-paper grid size-9 place-items-center rounded-full" aria-hidden>
          <Pause className="size-4 fill-current" />
        </span>
        <div className="bg-line relative h-1.5 flex-1 rounded-full">
          <div className="bg-trail absolute inset-y-0 left-0 rounded-full" style={{ width: '72%' }} />
        </div>
        <span className="text-ink-soft font-medium tabular-nums">60×</span>
      </div>
    </figure>
  )
}

function PanelStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-soft flex items-center gap-1.5 text-xs [&_svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="font-display mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</dd>
    </div>
  )
}

function SeriesChip({ color, label, on, icon }: { color: string; label: string; on?: boolean; icon?: ReactNode }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${on ? 'border-ink/20 bg-paper' : 'border-line text-ink-soft'}`}
    >
      {icon ?? <span className="size-2 rounded-full" style={{ background: color, opacity: on ? 1 : 0.5 }} />}
      {label}
    </span>
  )
}

// A made-up month that starts on a Tuesday; days map to hike colors.
const month = { name: 'June', offset: 1, days: 30 }
const hikeDays: Record<number, string[]> = {
  1: ['#2e86ab'],
  6: ['#e4572e'],
  7: ['#8cb369'],
  13: ['#e4572e', '#9c6ade'],
  14: ['#f4a259'],
  20: ['#2e86ab'],
  21: ['#e4572e'],
  24: ['#8cb369'],
  27: ['#9c6ade', '#2e86ab'],
  28: ['#e4572e'],
}

function Season() {
  const cells = [...Array(month.offset).fill(null), ...Array.from({ length: month.days }, (_, k) => k + 1)]
  return (
    <Section title="Your season, month by month" flip aside={
      <figure className="border-line rounded-[28px] border p-5 sm:p-7">
        <figcaption className="font-display flex items-baseline justify-between text-2xl font-bold tracking-tight">
          {month.name}
          <span className="text-ink-soft font-sans text-sm font-medium">12 hikes, 148 km</span>
        </figcaption>
        <div className="text-ink-soft mt-5 grid grid-cols-7 gap-1.5 text-center text-xs font-medium" aria-hidden>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <ol className="mt-2 grid grid-cols-7 gap-1.5">
          {cells.map((day, k) => (
            <li
              key={k}
              className={`flex aspect-square flex-col justify-between rounded-xl p-1.5 text-xs tabular-nums sm:p-2 sm:text-sm ${day ? (hikeDays[day] ? 'bg-paper-2 font-semibold' : 'text-ink-soft') : ''}`}
            >
              {day}
              {day && hikeDays[day] && (
                <span className="flex gap-1">
                  {hikeDays[day].map((c, i) => (
                    <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: c }} />
                  ))}
                </span>
              )}
            </li>
          ))}
        </ol>
      </figure>
    }>
      <p>
        The calendar lays your hikes out by day, so a busy June or a quiet winter is plain to see. Pick a day to open
        that hike.
      </p>
    </Section>
  )
}

const friends = [
  { id: 'b7e1c0d2-trail-friend-1', name: 'Léa' },
  { id: 'a31f9e44-trail-friend-2', name: 'Tomás' },
  { id: '5c02d8aa-trail-friend-3', name: 'Ines' },
]

const visibility = [
  { value: 'Private', text: 'Only you, and the friends you tag on a hike.' },
  { value: 'Friends', text: 'Friends see your map, calendar and every hike.' },
  { value: 'Public', text: 'Anyone with your profile link, no account needed.' },
]

function Together() {
  return (
    <Section title="Share the trail with the people on it" aside={
      <div className="grid gap-4">
        <figure className="border-line bg-paper-2 flex items-center justify-between gap-4 rounded-[28px] border p-5 sm:p-7">
          <figcaption>
            <div className="font-semibold">Tagged on this hike</div>
            <div className="text-ink-soft text-sm">It shows up on their map too.</div>
          </figcaption>
          <ul className="flex -space-x-3">
            {friends.map((f) => (
              <li key={f.id} className="bg-paper ring-paper-2 size-12 overflow-hidden rounded-full ring-4">
                <Blobatar name={f.id} title={f.name} className="size-full" />
              </li>
            ))}
          </ul>
        </figure>
        <fieldset className="border-line rounded-[28px] border p-2">
          <legend className="sr-only">Who can see your hikes</legend>
          {visibility.map((v, k) => (
            <div key={v.value} className={`flex items-start gap-3 rounded-[20px] p-4 ${k === 1 ? 'bg-paper-2' : ''}`}>
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${k === 1 ? 'border-trail' : 'border-ink/25'}`}
                aria-hidden
              >
                {k === 1 && <span className="bg-trail size-2 rounded-full" />}
              </span>
              <div>
                <div className="font-semibold">{v.value}</div>
                <div className="text-ink-soft text-sm">{v.text}</div>
              </div>
            </div>
          ))}
        </fieldset>
      </div>
    }>
      <p>
        Add friends by their ID and tag them on the hikes you did together. You choose who sees your hikes, and can
        change it any time.
      </p>
    </Section>
  )
}

const details = [
  { term: 'Tracks and routes', text: 'GPX from Garmin, Suunto, Coros, Strava exports and phone apps. Import many files at once.' },
  { term: 'Sensor data', text: 'Heart rate, cadence and temperature are read from Garmin track point extensions.' },
  { term: 'Your original file', text: 'Every upload is kept as is, so nothing your device recorded is lost.' },
  { term: 'Map backgrounds', text: 'Streets, topographic or satellite, with 3D terrain when you want to see the relief.' },
]

function Details() {
  return (
    <section className="border-line mx-auto max-w-7xl border-t px-4 py-20 sm:px-8 md:py-28">
      <h2 className="font-display max-w-[16ch] text-[clamp(2rem,4vw,3.25rem)] leading-[1] font-bold tracking-[-0.03em] text-balance">
        Straight from your watch
      </h2>
      <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {details.map((d) => (
          <div key={d.term}>
            <dt className="font-display text-xl font-semibold tracking-tight">{d.term}</dt>
            <dd className="text-ink-soft mt-2 leading-relaxed">{d.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Closing() {
  return (
    <section className="relative overflow-hidden">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full opacity-60"
        aria-hidden
      >
        <g fill="none" stroke="var(--contour)" strokeWidth={0.8} opacity={0.5}>
          {contourPaths.filter((c) => c.index).map((c, k) => (
            <path key={k} d={c.d} />
          ))}
        </g>
      </svg>
      <div className="relative mx-auto flex max-w-7xl flex-col items-start px-4 py-24 sm:px-8 md:py-36">
        <h2 className="font-display max-w-[14ch] text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] font-bold tracking-[-0.035em] text-balance">
          Bring your tracks home.
        </h2>
        <p className="text-ink-soft mt-5 max-w-[30rem] text-lg leading-relaxed">
          Create an account, drop in your GPX files and watch the map fill up.
        </p>
        <a href="/register" className="bg-trail hover:bg-trail/90 mt-8 rounded-full px-6 py-3 font-semibold text-white">
          Create an account
        </a>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-line text-ink-soft mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t px-4 py-8 text-sm sm:px-8">
      <span className="flex items-center gap-2">
        <MountainSnow className="size-4" aria-hidden />
        GPX Viewer
      </span>
      <a href="https://github.com/MatHoyer/gpx-viewer" className="hover:text-ink rounded underline-offset-4 hover:underline">
        Source on GitHub
      </a>
    </footer>
  )
}

