import i18n from '@/i18n'

import { ApiError } from './api'

/** The message for an API error code in the UI language, else fallback. */
export function codeMessage(code: string | undefined, params: Record<string, unknown> | undefined, fallback: string): string {
  return code && i18n.exists(`errors.${code}`) ? i18n.t(`errors.${code}`, params) : fallback
}

/**
 * What to tell the user about a failed request: the translation of the API's
 * error code when there is one, else the API's own message, else fallback.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback
  return codeMessage(err.code, { ...err.params, reason: err.reason }, err.message || fallback)
}
