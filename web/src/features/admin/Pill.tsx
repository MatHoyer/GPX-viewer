import type { ReactNode } from 'react'

import { useConfig } from '@/features/auth/useAuth'
import { cn } from '@/lib/utils'

import type { AdminUser } from './api'

const tones = {
  primary: 'bg-primary/10 text-primary',
  good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  danger: 'bg-destructive/10 text-destructive',
  muted: 'bg-muted text-muted-foreground',
}

export function Pill({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  )
}

/** The role and state of an account at a glance. */
export function UserPills({ user }: { user: AdminUser }) {
  // Without a mail server nobody verifies their email, so it says nothing.
  const emailEnabled = useConfig().data?.emailEnabled ?? true
  return (
    <>
      {user.isAdmin && <Pill tone="primary">Admin</Pill>}
      {user.bannedAt ? (
        <Pill tone="danger">Banned</Pill>
      ) : user.invitedAt ? (
        <Pill tone="muted">Invite pending</Pill>
      ) : (
        emailEnabled && !user.emailVerifiedAt && <Pill tone="muted">Email not verified</Pill>
      )}
    </>
  )
}
