import { api, ApiError } from '@/lib/api'

/** Who can see a user's profile and hikes. */
export type Visibility = 'private' | 'friends' | 'public'

export type User = {
  id: string
  email: string
  /** Empty when the user has not set a display name. */
  name: string
  visibility: Visibility
  createdAt: string
}

export type Credentials = {
  email: string
  password: string
}

export async function fetchMe(): Promise<User | null> {
  try {
    return await api<User>('/auth/me')
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

export function login(credentials: Credentials) {
  return api<void>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
}

/**
 * Creates an unverified account; it can sign in once the emailed link is followed.
 * Signing in while unverified answers 403 and emails a new link if the last one expired.
 */
export function register(credentials: Credentials) {
  return api<User>('/auth/register', { method: 'POST', body: JSON.stringify(credentials) })
}

/** Consumes the token from the verification link and starts a session. */
export function verifyEmail(token: string) {
  return api<void>('/auth/verify', { method: 'POST', body: JSON.stringify({ token }) })
}

/** Emails a reset link. Succeeds whether or not the email has an account. */
export function requestPasswordReset(email: string) {
  return api<void>('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) })
}

/** Consumes the token from the reset link, sets the password and starts a session. */
export function resetPassword(input: { token: string; password: string }) {
  return api<void>('/auth/password/reset', { method: 'POST', body: JSON.stringify(input) })
}

/** Signs out every other session; this one keeps going. */
export function changePassword(input: { currentPassword: string; password: string }) {
  return api<void>('/auth/password', { method: 'POST', body: JSON.stringify(input) })
}

export function logout() {
  return api<void>('/auth/logout', { method: 'POST' })
}
