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

export function register(credentials: Credentials) {
  return api<User>('/auth/register', { method: 'POST', body: JSON.stringify(credentials) })
}

export function logout() {
  return api<void>('/auth/logout', { method: 'POST' })
}
