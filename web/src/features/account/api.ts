import type { User, Visibility } from '@/features/auth/api'
import { api } from '@/lib/api'

/** Mirrors the API limit. */
export const MAX_NAME_LENGTH = 100

export function updateAccount(patch: { name?: string; visibility?: Visibility }) {
  return api<User>('/me', { method: 'PATCH', body: JSON.stringify(patch) })
}
