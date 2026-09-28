import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { ApiError } from '@/lib/api'

import { AuthShell } from './AuthShell'
import { CheckInbox } from './CheckInbox'
import { useConfig, useLogin, useRegister } from './useAuth'

type Mode = 'login' | 'register'

const copy = {
  login: {
    title: 'Welcome back',
    description: 'Sign in to see your hikes on the map.',
    submit: 'Sign in',
    switchText: 'No account yet?',
    switchLink: 'Create one',
    switchTo: '/register',
  },
  register: {
    title: 'Create an account',
    description: 'Import your GPX files and see every hike in one place.',
    submit: 'Create account',
    switchText: 'Already have an account?',
    switchLink: 'Sign in',
    switchTo: '/login',
  },
} satisfies Record<Mode, Record<string, string>>

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const loginMutation = useLogin()
  const registerMutation = useRegister()
  const config = useConfig()
  // Hidden until known, so a closed instance never flashes the link.
  const registrationOpen = config.data?.registrationOpen ?? false
  // Without a mail server there is no reset email nor verification to wait for.
  // Unknown until the config loads: hide the reset link, but expect to verify.
  const emailEnabled = config.data?.emailEnabled
  const mutation = mode === 'login' ? loginMutation : registerMutation
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Set once the account exists but its email is not confirmed yet.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const t = copy[mode]

  const error = mutation.error instanceof ApiError ? mutation.error : null
  const errorMessage = !mutation.error
    ? null
    : error?.code === 'banned'
      ? `Your account was suspended. Reason: ${error.reason}`
      : (error?.message ?? 'Something went wrong')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'register') {
      registerMutation.mutate(
        { email, password },
        {
          onSuccess: (user) => {
            if (emailEnabled !== false) setUnverifiedEmail(user.email)
            // Nothing to verify: sign straight in.
            else loginMutation.mutate({ email, password }, { onSuccess: () => navigate('/', { replace: true }) })
          },
        },
      )
      return
    }
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: () => navigate('/', { replace: true }),
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'email_not_verified') setUnverifiedEmail(email.trim())
        },
      },
    )
  }

  function onBack() {
    setUnverifiedEmail(null)
    setPassword('')
    loginMutation.reset()
    registerMutation.reset()
    navigate('/login')
  }

  if (mode === 'register' && config.data && !config.data.registrationOpen) {
    return (
      <AuthShell>
        <CardHeader>
          <CardTitle>Sign-up is closed</CardTitle>
          <CardDescription>This instance is invite-only. Ask its admin to invite you.</CardDescription>
        </CardHeader>
        <CardFooter className="mt-6">
          <Button asChild size="lg" className="h-11 w-full rounded-xl">
            <Link to="/login" replace>
              Sign in
            </Link>
          </Button>
        </CardFooter>
      </AuthShell>
    )
  }

  if (unverifiedEmail) {
    return (
      <AuthShell>
        <CheckInbox email={unverifiedEmail} onBack={onBack} />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
          <CardHeader>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit}>
            <CardContent className="space-y-4">
              <FloatingInput
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error?.field === 'email' || undefined}
              />
              <FloatingInput
                id="password"
                label="Password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'register' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error?.field === 'password' || undefined}
                description={mode === 'register' ? 'At least 8 characters.' : undefined}
              />
              {mode === 'login' && emailEnabled === true && (
                <Link
                  to={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password'}
                  className="text-muted-foreground hover:text-foreground block text-right text-sm underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              )}
              {errorMessage && (
                <p role="alert" className="text-destructive text-sm">
                  {errorMessage}
                </p>
              )}
            </CardContent>
            <CardFooter className="mt-6 flex-col gap-3">
              <Button type="submit" size="lg" className="h-11 w-full rounded-xl" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
                {t.submit}
              </Button>
              {(mode === 'register' || registrationOpen) && (
                <p className="text-muted-foreground text-sm">
                  {t.switchText}{' '}
                  <Link to={t.switchTo} className="text-foreground underline underline-offset-4">
                    {t.switchLink}
                  </Link>
                </p>
              )}
            </CardFooter>
          </form>
    </AuthShell>
  )
}

