import { Download, ExternalLink, Globe, Lock, UsersRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import type { User, Visibility } from '@/features/auth/api'
import { useChangePassword, useMe, useRequestPasswordReset } from '@/features/auth/useAuth'
import { SessionsCard } from '@/features/sessions/SessionsCard'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { MAX_NAME_LENGTH } from './api'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { useUpdateAccount } from './useAccount'
import { ThemeSwitcher } from './ThemeSwitcher'
import { UserAvatar } from './UserAvatar'

export function SettingsPage() {
  const me = useMe()

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        {me.data && (
          <div className="mx-auto max-w-2xl space-y-4 p-4">
            {/* Keyed so the form resets if the saved name changes elsewhere. */}
            <DetailsCard key={me.data.name} user={me.data} />
            <PasswordCard user={me.data} />
            <SessionsCard />
            <VisibilityCard user={me.data} />
            <ExportCard />
            <AppearanceCard />
            <DangerZoneCard user={me.data} />
          </div>
        )}
      </main>
    </div>
  )
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

function DetailsCard({ user }: { user: User }) {
  const [name, setName] = useState(user.name)
  const update = useUpdateAccount()
  const trimmed = name.trim()
  const dirty = trimmed !== user.name

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!dirty) return
    update.mutate(
      { name: trimmed },
      {
        onSuccess: () => toast.success('Profile saved'),
        onError: (err) => toast.error(errorMessage(err, 'Could not save profile')),
      },
    )
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="contents">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UserAvatar user={user} className="mx-auto size-28" />
          <FloatingInput
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={user.email.split('@')[0]}
            maxLength={MAX_NAME_LENGTH}
            description={`Leave empty to go by ${user.email.split('@')[0]}.`}
          />
          <FloatingInput label="Email" value={user.email} disabled />
          <p className="text-muted-foreground text-sm">Member since {formatDate(user.createdAt)}</p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={!dirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function PasswordCard({ user }: { user: User }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const change = useChangePassword()
  const sendReset = useRequestPasswordReset()
  const error = change.error instanceof ApiError ? change.error : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    change.mutate(
      { currentPassword, password },
      {
        onSuccess: () => {
          setCurrentPassword('')
          setPassword('')
          toast.success('Password changed', { description: 'Your other devices were signed out.' })
        },
      },
    )
  }

  function onForgot() {
    sendReset.mutate(user.email, {
      onSuccess: () => toast.success(`We sent a reset link to ${user.email}`),
      onError: (err) => toast.error(errorMessage(err, 'Could not send the reset link')),
    })
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="contents">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing it signs you out on your other devices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lets password managers tie the new password to this account. */}
          <input type="email" autoComplete="username" value={user.email} readOnly hidden />
          <FloatingInput
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            aria-invalid={error?.field === 'currentPassword' || undefined}
          />
          <FloatingInput
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error?.field === 'password' || undefined}
            description="At least 8 characters."
          />
          {change.error && (
            <p role="alert" className="text-destructive text-sm">
              {errorMessage(change.error, 'Could not change password')}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-2">
          <Button type="button" variant="link" className="px-0" disabled={sendReset.isPending} onClick={onForgot}>
            Forgot your current password?
          </Button>
          <Button type="submit" disabled={!currentPassword || !password || change.isPending}>
            {change.isPending ? 'Changing…' : 'Change password'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

const visibilityOptions: { value: Visibility; label: string; description: string; icon: typeof Lock }[] = [
  { value: 'private', label: 'Private', description: 'Only you can see your hikes.', icon: Lock },
  { value: 'friends', label: 'Friends', description: 'Your friends can see your profile and hikes.', icon: UsersRound },
  { value: 'public', label: 'Public', description: 'Anyone with the link can, even without an account.', icon: Globe },
]

function VisibilityCard({ user }: { user: User }) {
  const update = useUpdateAccount()

  function select(visibility: Visibility) {
    if (visibility === user.visibility || update.isPending) return
    update.mutate(
      { visibility },
      {
        onSuccess: () => toast.success('Visibility updated'),
        onError: (err) => toast.error(errorMessage(err, 'Could not update visibility')),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who can see my hikes</CardTitle>
        <CardDescription>Anyone with your friend ID can see your name and picture to send you a friend request.</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Profile visibility" className="grid gap-2 sm:grid-cols-3">
          {visibilityOptions.map(({ value, label, description, icon: Icon }) => {
            const checked = user.visibility === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={update.isPending}
                onClick={() => select(value)}
                className={cn(
                  'hover:bg-muted/50 focus-visible:ring-ring/50 flex flex-col gap-1 rounded-lg border p-3 text-left outline-none focus-visible:ring-3 disabled:opacity-60',
                  checked && 'border-primary bg-primary/5 ring-primary ring-1',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4" />
                  {label}
                </span>
                <span className="text-muted-foreground text-xs">{description}</span>
              </button>
            )
          })}
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button asChild variant="outline">
          <Link to={`/u/${user.id}`}>
            <ExternalLink />
            View my profile
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function ExportCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export</CardTitle>
        <CardDescription>
          Download the original GPX files of all your hikes as a zip. Hikes you are tagged on stay with their owner.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-end">
        <Button asChild variant="outline">
          <a href="/api/hikes/export" download>
            <Download />
            Download my hikes
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

function DangerZoneCard({ user }: { user: User }) {
  return (
    <Card className="ring-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>
          Deleting your account removes your hikes, tags, friends, kudos and comments for good. It cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-end">
        <DeleteAccountDialog user={user} />
      </CardFooter>
    </Card>
  )
}

function AppearanceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>System follows your device setting.</CardDescription>
      </CardHeader>
      <CardContent>
        <ThemeSwitcher />
      </CardContent>
    </Card>
  )
}
