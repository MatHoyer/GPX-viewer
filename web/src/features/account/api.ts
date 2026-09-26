import type { User, Visibility } from '@/features/auth/api'
import { api } from '@/lib/api'

/** Mirrors the API limits. */
export const MAX_NAME_LENGTH = 100
export const MAX_AVATAR_BYTES = 2 << 20
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export function updateAccount(patch: { name?: string; visibility?: Visibility }) {
  return api<User>('/me', { method: 'PATCH', body: JSON.stringify(patch) })
}

export function uploadAvatar(file: File) {
  const body = new FormData()
  body.append('avatar', file)
  return api<User>('/me/avatar', { method: 'PUT', body })
}

export function deleteAvatar() {
  return api<User>('/me/avatar', { method: 'DELETE' })
}
