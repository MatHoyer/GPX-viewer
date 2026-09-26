import type { Person } from '@/features/account/displayName'
import type { Visibility } from '@/features/auth/api'
import type { Hike, Tracks } from '@/features/hikes/api'
import { api } from '@/lib/api'

export type PublicUser = Person & { createdAt: string }

/** How the viewer relates to a user. */
export type Relation = 'none' | 'self' | 'friends' | 'outgoing' | 'incoming'

export type UserProfile = {
  user: PublicUser
  visibility: Visibility
  relation: Relation
  /** False when the user's hikes are hidden from the viewer. */
  canView: boolean
}

export type Connections = {
  friends: PublicUser[]
  incoming: PublicUser[]
  outgoing: PublicUser[]
}

export function getUserProfile(id: string) {
  return api<UserProfile>(`/users/${id}`)
}

export function listUserHikes(id: string) {
  return api<Hike[]>(`/users/${id}/hikes`)
}

export function getUserTracks(id: string) {
  return api<Tracks>(`/users/${id}/hikes/tracks`)
}

export function getConnections() {
  return api<Connections>('/friends')
}

/** Sends a friend request, or accepts the one this user sent. */
export async function addFriend(id: string) {
  const res = await api<{ relation: Relation }>(`/friends/${id}`, { method: 'PUT' })
  return res.relation
}

/** Unfriends, cancels a sent request or declines a received one. */
export function removeFriend(id: string) {
  return api<void>(`/friends/${id}`, { method: 'DELETE' })
}
