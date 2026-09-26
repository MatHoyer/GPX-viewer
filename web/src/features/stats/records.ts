import type { Hike } from '@/features/hikes/api'
import { formatDistance, formatDuration, formatElevation, formatPace } from '@/lib/format'

export type PersonalRecord = {
  key: string
  label: string
  hike: Hike
  value: string
  detail?: string
}

type Candidate = { key: string; label: string; score: (h: Hike) => number | null; show: (h: Hike) => Pick<PersonalRecord, 'value' | 'detail'> }

/** 1000 → "Fastest 1 km", 21097 → "Fastest 21.1 km". */
const effortLabel = (m: number) => `Fastest ${Number((m / 1000).toFixed(1))} km`

function effort(h: Hike, distanceM: number) {
  return h.bestEfforts.find((e) => e.distanceM === distanceM)
}

function candidates(hikes: Hike[]): Candidate[] {
  const distances = [...new Set(hikes.flatMap((h) => h.bestEfforts.map((e) => e.distanceM)))].sort((a, b) => a - b)
  return [
    {
      key: 'distance',
      label: 'Longest hike',
      score: (h) => h.distanceM,
      show: (h) => ({ value: formatDistance(h.distanceM) }),
    },
    {
      key: 'gain',
      label: 'Most elevation gain',
      score: (h) => h.elevationGainM,
      show: (h) => ({ value: `+${formatElevation(h.elevationGainM)}` }),
    },
    {
      key: 'highest',
      label: 'Highest point',
      score: (h) => h.maxEleM,
      show: (h) => ({ value: formatElevation(h.maxEleM ?? 0) }),
    },
    {
      key: 'duration',
      label: 'Longest time out',
      score: (h) => (h.durationS > 0 ? h.durationS : null),
      show: (h) => ({ value: formatDuration(h.durationS) }),
    },
    // Lower is better for efforts, so their score is negated.
    ...distances.map((d) => ({
      key: `effort-${d}`,
      label: effortLabel(d),
      score: (h: Hike) => {
        const e = effort(h, d)
        return e ? -e.durationS : null
      },
      show: (h: Hike) => {
        const s = effort(h, d)!.durationS
        return { value: formatDuration(s), detail: `${formatPace(s / 60 / (d / 1000))} /km` }
      },
    })),
  ]
}

/**
 * The best hike for each record. Ties go to whichever hike set it first, so a
 * record changes hands only when beaten. Records no hike has are left out.
 */
export function personalRecords(hikes: Hike[]): PersonalRecord[] {
  // The list is newest first; walk it oldest first.
  const oldestFirst = [...hikes].reverse()
  return candidates(hikes).flatMap((c) => {
    let best: Hike | null = null
    let bestScore = -Infinity
    for (const h of oldestFirst) {
      const s = c.score(h)
      if (s !== null && s > bestScore && s !== 0) {
        best = h
        bestScore = s
      }
    }
    return best ? [{ key: c.key, label: c.label, hike: best, ...c.show(best) }] : []
  })
}
