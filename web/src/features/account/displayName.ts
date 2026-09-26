import type { User } from '@/features/auth/api'

/** The fields needed to show someone: other users' emails are never sent. */
export type Person = Pick<User, 'id' | 'name'> & { email?: string }

/** The name to show for a user: their display name, else the local part of their email. */
export function displayName(user: Pick<Person, 'name' | 'email'>): string {
  return user.name || user.email?.split('@')[0] || 'Unnamed hiker'
}
