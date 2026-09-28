import { api } from '@/lib/api'

/** A user as listed in the admin panel. */
export type AdminUser = {
  id: string
  email: string
  name: string
  isAdmin: boolean
  /** Null until they follow their verification or invite link. */
  emailVerifiedAt: string | null
  bannedAt: string | null
  banReason: string
  hikes: number
  /** When their latest live session started. */
  lastSeenAt: string | null
  createdAt: string
}

export type Invite = {
  inviteLink: string
  /** False when no email was asked for or it could not be sent. */
  emailSent: boolean
}

/** Mirrors the API limit. */
export const MAX_BAN_REASON_LENGTH = 500

export function fetchUsers() {
  return api<AdminUser[]>('/admin/users')
}

/** Creates an account whatever the registration setting; its owner sets a password through the link. */
export function createUser(input: { email: string; name: string; sendEmail: boolean }) {
  return api<Invite & { user: AdminUser }>('/admin/users', { method: 'POST', body: JSON.stringify(input) })
}

/** Replaces the invite link of a user who has not signed in yet. */
export function reissueInvite(input: { id: string; sendEmail: boolean }) {
  return api<Invite>(`/admin/users/${input.id}/invite`, {
    method: 'POST',
    body: JSON.stringify({ sendEmail: input.sendEmail }),
  })
}

/** Signs the user out everywhere; they see the reason when they try to sign in. */
export function banUser(input: { id: string; reason: string }) {
  return api<void>(`/admin/users/${input.id}/ban`, { method: 'PUT', body: JSON.stringify({ reason: input.reason }) })
}

export function unbanUser(id: string) {
  return api<void>(`/admin/users/${id}/ban`, { method: 'DELETE' })
}

export function setAdmin(input: { id: string; admin: boolean }) {
  return api<void>(`/admin/users/${input.id}/admin`, { method: input.admin ? 'PUT' : 'DELETE' })
}
