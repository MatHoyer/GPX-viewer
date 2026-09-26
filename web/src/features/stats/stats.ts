import { dayKey } from '@/features/calendar/month'
import type { Hike } from '@/features/hikes/api'

export type Totals = {
  count: number
  distanceM: number
  gainM: number
  /** Moving time where the track has it, else elapsed duration. */
  timeS: number
  /** Distinct days with at least one hike. */
  days: number
}

export type Metric = 'distance' | 'gain' | 'time' | 'count'

export function metricValue(t: Totals, m: Metric): number {
  switch (m) {
    case 'distance':
      return t.distanceM
    case 'gain':
      return t.gainM
    case 'time':
      return t.timeS
    case 'count':
      return t.count
  }
}

export function totals(hikes: Hike[]): Totals {
  const days = new Set<string>()
  const t = { count: 0, distanceM: 0, gainM: 0, timeS: 0, days: 0 }
  for (const h of hikes) {
    t.count++
    t.distanceM += h.distanceM
    t.gainM += h.elevationGainM
    t.timeS += h.movingS ?? h.durationS
    if (h.startedAt) days.add(dayKey(new Date(h.startedAt)))
  }
  t.days = days.size
  return t
}

function localDate(h: Hike): Date | null {
  return h.startedAt ? new Date(h.startedAt) : null
}

/** Years with at least one dated hike, newest first. */
export function hikeYears(hikes: Hike[]): number[] {
  const years = new Set<number>()
  for (const h of hikes) {
    const d = localDate(h)
    if (d) years.add(d.getFullYear())
  }
  return [...years].sort((a, b) => b - a)
}

export function inYear(hikes: Hike[], year: number): Hike[] {
  return hikes.filter((h) => localDate(h)?.getFullYear() === year)
}

/** Totals for each month of a year, January first. */
export function monthlyTotals(hikes: Hike[], year: number): Totals[] {
  const months: Hike[][] = Array.from({ length: 12 }, () => [])
  for (const h of inYear(hikes, year)) months[localDate(h)!.getMonth()].push(h)
  return months.map(totals)
}

/** Totals for each year from the first to the last with hikes, oldest first. */
export function yearlyTotals(hikes: Hike[]): { year: number; totals: Totals }[] {
  const years = hikeYears(hikes)
  if (years.length === 0) return []
  const out = []
  for (let y = years[years.length - 1]; y <= years[0]; y++) out.push({ year: y, totals: totals(inYear(hikes, y)) })
  return out
}

/** Monday of the week containing `d`, as a day count since the epoch in local time. */
function weekIndex(d: Date): number {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  return Math.round(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) / (7 * 86_400_000))
}

/** Longest run of consecutive weeks (Monday to Sunday) with at least one hike. */
export function longestWeekStreak(hikes: Hike[]): number {
  const weeks = [...new Set(hikes.flatMap((h) => (h.startedAt ? [weekIndex(new Date(h.startedAt))] : [])))].sort(
    (a, b) => a - b,
  )
  let best = 0
  let run = 0
  weeks.forEach((w, i) => {
    run = i > 0 && w === weeks[i - 1] + 1 ? run + 1 : 1
    best = Math.max(best, run)
  })
  return best
}

/** Relative change from `prev` to `cur`, or null when there is nothing to compare to. */
export function change(cur: number, prev: number): number | null {
  return prev > 0 ? (cur - prev) / prev : null
}
