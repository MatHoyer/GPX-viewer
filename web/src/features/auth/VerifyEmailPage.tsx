import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError } from '@/lib/api'

import { AuthShell } from './AuthShell'
import { useVerifyEmail } from './useAuth'

/** Landing page of the emailed verification link: confirms and signs in. */
export function VerifyEmailPage() {
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
  const message =
    verify.error instanceof ApiError ? verify.error.message : 'Something went wrong, try again later.'

  return (
    <AuthShell>
      <CardHeader>
        <CardTitle>{failed ? 'Could not confirm your email' : 'Confirming your email…'}</CardTitle>
        {failed && (
          <CardDescription role="alert">
            {token ? message : 'This link is incomplete.'} Try signing in.
          </CardDescription>
        )}
      </CardHeader>
      {failed && (
        <CardFooter className="mt-6">
          <Button asChild size="lg" className="h-11 w-full rounded-xl">
            <Link to="/login" replace>
              Sign in
            </Link>
          </Button>
        </CardFooter>
      )}
    </AuthShell>
  )
}
