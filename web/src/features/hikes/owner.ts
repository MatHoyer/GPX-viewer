import { displayName } from '@/features/account/displayName'

import type { Hike } from './api'

/** Name of the owner of a hike `userId` was tagged on, or null when `userId` owns it. */
export function taggedBy(hike: Hike, userId: string | undefined): string | null {
  return hike.owner && hike.userId !== userId ? displayName(hike.owner) : null
}
