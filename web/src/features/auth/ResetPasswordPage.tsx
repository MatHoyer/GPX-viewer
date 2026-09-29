import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { ApiError } from '@/lib/api'
import { errorMessage } from '@/lib/errors'

import { AuthShell } from './AuthShell'
import { useConfig, useResetPassword } from './useAuth'

/**
 * Landing page of the emailed reset link, and of invite links (invite=1) from
 * an admin: sets a password and signs in.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const invite = params.get('invite') === '1'
  const emailEnabled = useConfig().data?.emailEnabled === true
  const [password, setPassword] = useState('')
  const reset = useResetPassword()

  const error = reset.error instanceof ApiError ? reset.error : null
  // A 400 without a field means the link itself is invalid or expired; other
  // errors (bad password, rate limit) can be retried from this form.
  const linkFailed = !token || (error?.status === 400 && !error.field)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    reset.mutate(
      { token, password },
      {
        onSuccess: () => {
          toast.success(invite ? t('auth.welcomeAboard') : t('auth.passwordUpdated'))
          navigate('/', { replace: true })
        },
      },
    )
  }

  if (linkFailed) {
    return (
      <AuthShell>
        <CardHeader>
          <CardTitle>{invite ? t('auth.inviteFailed') : t('auth.resetFailed')}</CardTitle>
          <CardDescription role="alert">
            {token ? errorMessage(reset.error, '') : t('auth.linkIncomplete')}{' '}
            {invite ? t('auth.askInviter') : emailEnabled ? t('auth.askNewLink') : t('auth.askAdminNewLink')}
          </CardDescription>
        </CardHeader>
        {!invite && emailEnabled && (
          <CardFooter className="mt-6">
            <Button asChild size="lg" className="h-11 w-full rounded-xl">
              <Link to="/forgot-password" replace>
                {t('auth.sendNewLink')}
              </Link>
            </Button>
          </CardFooter>
        )}
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <CardHeader>
        <CardTitle>{invite ? t('auth.inviteTitle') : t('auth.newPasswordTitle')}</CardTitle>
        <CardDescription>
          {invite ? t('auth.inviteDescription') : t('auth.newPasswordDescription')}
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <FloatingInput
            id="password"
            label={invite ? t('common.password') : t('settings.newPassword')}
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error?.field === 'password' || undefined}
            description={t('settings.passwordRule')}
          />
          {reset.isError && (
            <p role="alert" className="text-destructive text-sm">
              {errorMessage(reset.error, t('errors.tryLater'))}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" size="lg" className="h-11 w-full rounded-xl" disabled={reset.isPending}>
            {reset.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {t('auth.setPassword')}
          </Button>
        </CardFooter>
      </form>
    </AuthShell>
  )
}
