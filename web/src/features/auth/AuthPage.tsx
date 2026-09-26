import { MountainSnow } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { ApiError } from '@/lib/api'

import { useLogin, useRegister } from './useAuth'

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
  const mutation = mode === 'login' ? loginMutation : registerMutation
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const t = copy[mode]

  const error = mutation.error instanceof ApiError ? mutation.error : null
  const errorMessage = mutation.error ? (error?.message ?? 'Something went wrong') : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate({ email, password }, { onSuccess: () => navigate('/', { replace: true }) })
  }

  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2 text-lg font-semibold">
          <MountainSnow className="size-6" />
          GPX Viewer
        </div>
        <Card>
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
              {errorMessage && (
                <p role="alert" className="text-destructive text-sm">
                  {errorMessage}
                </p>
              )}
            </CardContent>
            <CardFooter className="mt-6 flex-col gap-3">
              <Button type="submit" size="lg" className="h-11 w-full rounded-xl" disabled={mutation.isPending}>
                {t.submit}
              </Button>
              <p className="text-muted-foreground text-sm">
                {t.switchText}{' '}
                <Link to={t.switchTo} className="text-foreground underline underline-offset-4">
                  {t.switchLink}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
