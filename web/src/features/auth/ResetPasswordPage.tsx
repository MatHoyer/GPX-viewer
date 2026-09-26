import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { ApiError } from '@/lib/api'

import { AuthShell } from './AuthShell'
import { useResetPassword } from './useAuth'

/** Landing page of the emailed reset link: sets a new password and signs in. */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const reset = useResetPassword()

  const error = reset.error instanceof ApiError ? reset.error : null
  // Field errors can be fixed here; anything else means the link is unusable.
  const linkFailed = !token || (reset.isError && !error?.field)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    reset.mutate(
      { token, password },
      {
        onSuccess: () => {
          toast.success('Password updated')
          navigate('/', { replace: true })
        },
      },
    )
  }

  if (linkFailed) {
    return (
      <AuthShell>
        <CardHeader>
          <CardTitle>Could not reset your password</CardTitle>
          <CardDescription role="alert">
            {token ? (error?.message ?? 'Something went wrong, try again later.') : 'This link is incomplete.'} Ask
            for a new link.
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-6">
          <Button asChild size="lg" className="h-11 w-full rounded-xl">
            <Link to="/forgot-password" replace>
              Send a new link
            </Link>
          </Button>
        </CardFooter>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>You will be signed out everywhere else.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <FloatingInput
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error?.field === 'password' || undefined}
            description="At least 8 characters."
          />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error.message}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" size="lg" className="h-11 w-full rounded-xl" disabled={reset.isPending}>
            {reset.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Set password
          </Button>
        </CardFooter>
      </form>
    </AuthShell>
  )
}
