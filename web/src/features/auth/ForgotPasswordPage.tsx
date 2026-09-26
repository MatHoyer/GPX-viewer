import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { ApiError } from '@/lib/api'

import { AuthShell } from './AuthShell'
import { CheckInbox } from './CheckInbox'
import { useRequestPasswordReset } from './useAuth'

/** Asks for the account email and sends it a password reset link. */
export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const request = useRequestPasswordReset()

  const errorMessage = request.error
    ? request.error instanceof ApiError
      ? request.error.message
      : 'Something went wrong'
    : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    request.mutate(email.trim())
  }

  if (request.isSuccess) {
    return (
      <AuthShell>
        <CheckInbox email={email.trim()} onBack={() => navigate('/login')}>
          If an account exists for <span className="text-foreground font-medium">{email.trim()}</span>, we sent it a
          link to choose a new password. It expires after 1 hour.
        </CheckInbox>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>Enter your account email and we will send you a link to choose a new one.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <FloatingInput
            id="email"
            label="Email"
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
            Send reset link
          </Button>
          <p className="text-muted-foreground text-sm">
            Remembered it?{' '}
            <Link to="/login" className="text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </AuthShell>
  )
}
