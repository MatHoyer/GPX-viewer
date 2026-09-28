import { api } from '@/lib/api'

/** A device someone is signed in on. */
export type Session = {
  id: string
  userAgent: string
  /** Where it was last used from. */
  ip: string
  createdAt: string
  /** Updated at most every few minutes. */
  lastUsedAt: string
  expiresAt: string
  /** The session making the request; always false in the admin view. */
  current: boolean
}

export function fetchMySessions() {
  return api<Session[]>('/me/sessions')
}

/** Signs out another of your devices; the current one is refused. */
export function revokeMySession(id: string) {
  return api<void>(`/me/sessions/${id}`, { method: 'DELETE' })
}

/** Signs out every device but this one. */
export function revokeMyOtherSessions() {
  return api<void>('/me/sessions', { method: 'DELETE' })
}
