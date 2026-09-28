import { HelpCircle, Laptop, Smartphone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatDate, formatRelative } from '@/lib/format'

import type { Session } from './api'
import { describeUserAgent, type Device } from './userAgent'

const deviceIcons: Record<Device, typeof Laptop> = {
  desktop: Laptop,
  mobile: Smartphone,
  unknown: HelpCircle,
}

type Props = {
  sessions: Session[]
  /** Omitted to only show the sessions. */
  onRevoke?: (session: Session) => void
  /** The session being revoked, whose button shows as busy. */
  revoking?: string
}

/** Signed-in devices, each with a sign-out button except the current one. */
export function SessionList({ sessions, onRevoke, revoking }: Props) {
  if (sessions.length === 0) {
    return <p className="text-muted-foreground text-sm">Not signed in anywhere.</p>
  }
  return (
    <ul className="divide-y">
      {sessions.map((s) => {
        const { label, device } = describeUserAgent(s.userAgent)
        const Icon = deviceIcons[device]
        return (
          <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                {label}
                {s.current && (
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                    This device
                  </span>
                )}
              </p>
              <p className="text-muted-foreground text-xs">
                {[
                  s.ip,
                  s.current ? 'active now' : `active ${formatRelative(s.lastUsedAt)}`,
                  `signed in ${formatDate(s.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {onRevoke && !s.current && (
              <Button variant="outline" size="sm" onClick={() => onRevoke(s)} disabled={revoking === s.id}>
                {revoking === s.id ? 'Signing out…' : 'Sign out'}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
