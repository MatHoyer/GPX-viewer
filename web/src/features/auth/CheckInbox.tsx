import { MailCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Shown once a link was emailed: after registering, when signing in before the
 * email is verified, or after asking for a password reset.
 */
export function CheckInbox({ email, onBack, children }: { email: string; onBack: () => void; children?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <>
      <CardHeader>
        <MailCheck className="text-muted-foreground mb-2 size-8" />
        <CardTitle>{t('auth.checkInbox')}</CardTitle>
        <CardDescription>
          {children ?? (
            <Trans
              i18nKey="auth.verifySent"
              values={{ email }}
              components={{ email: <span className="text-foreground font-medium" /> }}
            />
          )}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-6">
        <Button type="button" variant="outline" size="lg" className="h-11 w-full rounded-xl" onClick={onBack}>
          {t('auth.backToSignIn')}
        </Button>
      </CardFooter>
    </>
  )
}
