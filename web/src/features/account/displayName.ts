import type { User } from '@/features/auth/api'

/** The name to show for a user: their display name, else the local part of their email. */
export function displayName(user: Pick<User, 'name' | 'email'>): string {
  return user.name || user.email.split('@')[0]
}
