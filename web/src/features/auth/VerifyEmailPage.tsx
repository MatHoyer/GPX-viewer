import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError } from '@/lib/api'
import { errorMessage } from '@/lib/errors'

import { AuthShell } from './AuthShell'
import { useVerifyEmail } from './useAuth'

/** Landing page of the emailed verification link: confirms and signs in. */
export function VerifyEmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const verify = useVerifyEmail()
  // A token works once; StrictMode would otherwise submit it twice.
  const submitted = useRef(false)

  useEffect(() => {
    if (!token || submitted.current) return
    submitted.current = true
    verify.mutate(token, { onSuccess: () => navigate('/', { replace: true }) })
  }, [token, verify, navigate])

  const failed = !token || verify.isError
  const error = verify.error instanceof ApiError ? verify.error : null
  const message = errorMessage(verify.error, t('errors.tryLater'))
  // Rate limited: the link may still be good, so retrying beats signing in.
  const hint = error?.status === 429 ? '' : ` ${t('auth.trySigningIn')}`

  return (
    <AuthShell>
      <CardHeader>
        <CardTitle>{failed ? t('auth.verifyFailed') : t('auth.verifying')}</CardTitle>
        {failed && (
          <CardDescription role="alert">
            {token ? message : t('auth.linkIncomplete')}
            {hint}
          </CardDescription>
        )}
      </CardHeader>
      {failed && (
        <CardFooter className="mt-6">
          <Button asChild size="lg" className="h-11 w-full rounded-xl">
            <Link to="/login" replace>
              {t('common.signIn')}
            </Link>
          </Button>
        </CardFooter>
      )}
    </AuthShell>
  )
}
