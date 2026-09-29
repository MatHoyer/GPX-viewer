import i18n from '@/i18n'

import { ApiError } from './api'

/**
 * What to tell the user about a failed request: the translation of the API's
 * error code when there is one, else the API's own message, else fallback.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback
  if (err.code && i18n.exists(`errors.${err.code}`)) {
    return i18n.t(`errors.${err.code}`, { ...err.params, reason: err.reason })
  }
  return err.message || fallback
}
