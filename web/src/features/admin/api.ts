import type { Session } from '@/features/sessions/api'
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

export type UserPage = {
  users: AdminUser[]
  /** Users matching the search, across all pages. */
  total: number
  page: number
  pageSize: number
}

/** A page (from 1) of users whose email or name contains q, oldest first. */
export function fetchUsers({ q, page }: { q: string; page: number }) {
  const params = new URLSearchParams({ page: String(page) })
  if (q) params.set('q', q)
  return api<UserPage>(`/admin/users?${params}`)
}

export function fetchUser(id: string) {
  return api<AdminUser>(`/admin/users/${id}`)
}

export function fetchUserSessions(id: string) {
  return api<Session[]>(`/admin/users/${id}/sessions`)
}

export function revokeUserSession(input: { userId: string; id: string }) {
  return api<void>(`/admin/users/${input.userId}/sessions/${input.id}`, { method: 'DELETE' })
}

/** Signs the user out everywhere; unlike a ban, they can sign in again. */
export function revokeUserSessions(id: string) {
  return api<void>(`/admin/users/${id}/sessions`, { method: 'DELETE' })
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

/** Deletes the account of a user who has not accepted their invite, voiding the link. */
export function revokeInvite(id: string) {
  return api<void>(`/admin/users/${id}/invite`, { method: 'DELETE' })
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
