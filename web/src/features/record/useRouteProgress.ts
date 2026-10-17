import { useState } from 'react'

import type { Profile } from '@/features/hike-detail/profile'

import { progressOnRoute, type RouteProgress } from './route'
import type { Here } from './store'

type Matched = { profile: Profile; here: Here; progress: RouteProgress }

/** Where `here` is along the route, following on from the previous match. */
export function useRouteProgress(profile: Profile | undefined, here: Here | null): RouteProgress | null {
  const [matched, setMatched] = useState<Matched | null>(null)
  if (!profile || !here) return matched?.progress ?? null
  if (matched?.profile === profile && matched.here === here) return matched.progress
  // Updating state while rendering: React re-renders right away, before any effect.
  const progress = progressOnRoute(profile, here.lat, here.lon, matched?.profile === profile ? matched.progress.index : null)
  setMatched({ profile, here, progress })
  return progress
}
