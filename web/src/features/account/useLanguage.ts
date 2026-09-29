import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useMe } from '@/features/auth/useAuth'
import { isLanguage, setLanguage, type Language } from '@/i18n'

import { useUpdateAccount } from './useAccount'

/** Switches the language here, and on the account when signed in so it follows the user. */
export function useSetLanguage() {
  const me = useMe()
  const update = useUpdateAccount()
  return (lng: Language) => {
    setLanguage(lng)
    if (me.data && me.data.language !== lng) update.mutate({ language: lng })
  }
}

/**
 * Applies the account's language once the user is known. An account that
 * never picked one takes the language this device already shows.
 */
export function useAccountLanguage() {
  const { i18n } = useTranslation()
  const me = useMe()
  const update = useUpdateAccount()
  const saved = me.data?.language
  const signedIn = !!me.data

  useEffect(() => {
    if (!signedIn) return
    if (isLanguage(saved)) {
      if (saved !== i18n.language) setLanguage(saved)
    } else if (isLanguage(i18n.language)) {
      update.mutate({ language: i18n.language })
    }
    // Only when the account's saved language changes, not on every switch here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, saved])
}
