import type { Language } from '@/i18n'
import { api, ApiError } from '@/lib/api'

/** Who can see a user's profile and hikes. */
export type Visibility = 'private' | 'friends' | 'public'

export type User = {
  id: string
  email: string
  /** Empty when the user has not set a display name. */
  name: string
  visibility: Visibility
  /** Empty until the user picks one; then it follows them across devices. */
  language: Language | ''
  /** Can open the admin panel. */
  isAdmin: boolean
  createdAt: string
}

/** How the instance is set up, as anyone may see it. */
export type AppConfig = {
  /** Mirrors REGISTRATION_ENABLED on the server. */
  registrationEnabled: boolean
  /** Whether the sign-up form accepts accounts; also true before the first account exists. */
  registrationOpen: boolean
  /**
   * False without a mail server: nothing is emailed, accounts sign in without
   * verifying their email, and admins hand out password links.
   */
  emailEnabled: boolean
}

export function fetchConfig() {
  return api<AppConfig>('/config')
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

/** Permanently deletes the account and everything tied to it, then signs out. */
export function deleteAccount(password: string) {
  return api<void>('/me', { method: 'DELETE', body: JSON.stringify({ password }) })
}

export function logout() {
  return api<void>('/auth/logout', { method: 'POST' })
}
