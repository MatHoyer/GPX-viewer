import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { errorMessage as describeError } from '@/lib/errors'

import { AuthShell } from './AuthShell'
import { CheckInbox } from './CheckInbox'
import { useConfig, useRequestPasswordReset } from './useAuth'

/** Asks for the account email and sends it a password reset link. */
export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const request = useRequestPasswordReset()
  const config = useConfig()

  const errorMessage = request.error ? describeError(request.error, t('errors.generic')) : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    request.mutate(email.trim())
  }

  if (config.data && !config.data.emailEnabled) {
    return (
      <AuthShell>
        <CardHeader>
          <CardTitle>{t('auth.askAdmin')}</CardTitle>
          <CardDescription>{t('auth.askAdminDescription')}</CardDescription>
        </CardHeader>
        <CardFooter className="mt-6">
          <Button asChild size="lg" className="h-11 w-full rounded-xl">
            <Link to="/login" replace>
              {t('auth.backToSignIn')}
            </Link>
          </Button>
        </CardFooter>
      </AuthShell>
    )
  }

  if (request.isSuccess) {
    return (
      <AuthShell>
        <CheckInbox email={email.trim()} onBack={() => navigate('/login')}>
          <Trans
            i18nKey="auth.resetSent"
            values={{ email: email.trim() }}
            components={{ email: <span className="text-foreground font-medium" /> }}
          />
        </CheckInbox>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <CardHeader>
        <CardTitle>{t('auth.resetTitle')}</CardTitle>
        <CardDescription>{t('auth.resetDescription')}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <FloatingInput
            id="email"
            label={t('common.email')}
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errorMessage && (
            <p role="alert" className="text-destructive text-sm">
              {errorMessage}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-6 flex-col gap-3">
          <Button type="submit" size="lg" className="h-11 w-full rounded-xl" disabled={request.isPending}>
            {request.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {t('auth.sendResetLink')}
          </Button>
          <p className="text-muted-foreground text-sm">
            {t('auth.remembered')}{' '}
            <Link to="/login" className="text-foreground underline underline-offset-4">
              {t('common.signIn')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </AuthShell>
  )
}
