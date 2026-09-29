export class ApiError extends Error {
  readonly status: number
  readonly field?: string
  /** Tells apart errors the UI reacts to, e.g. 'banned' or 'email_not_verified'. */
  readonly code?: string
  /** Why an admin suspended the account, with code 'banned'. */
  readonly reason?: string
  /** Values the message for code is built from, e.g. a length limit. */
  readonly params?: Record<string, string | number>

  constructor(
    status: number,
    message: string,
    details: { field?: string; code?: string; reason?: string; params?: Record<string, string | number> } = {},
  ) {
    super(message)
    this.status = status
    this.field = details.field
    this.code = details.code
    this.reason = details.reason
    this.params = details.params
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' })
  if (!res.ok) {
    let message = res.statusText
    let details = {}
    try {
      const body = (await res.json()) as {
        error?: string
        field?: string
        code?: string
        reason?: string
        params?: Record<string, string | number>
      }
      message = body.error ?? message
      details = { field: body.field, code: body.code, reason: body.reason, params: body.params }
    } catch {
      // Non-JSON error body.
    }
    throw new ApiError(res.status, message, details)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}
