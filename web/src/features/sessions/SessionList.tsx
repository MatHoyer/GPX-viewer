import { HelpCircle, Laptop, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatDate, formatRelative } from '@/lib/format'

import type { Session } from './api'
import { describeUserAgent, type Device } from './userAgent'

const deviceIcons: Record<Device, typeof Laptop> = {
  desktop: Laptop,
  mobile: Smartphone,
  unknown: HelpCircle,
}

/** How many sessions show before "Show all". */
const COLLAPSED = 3

type Props = {
  sessions: Session[]
  /** Omitted to only show the sessions. */
  onRevoke?: (session: Session) => void
  /** The session being revoked, whose button shows as busy. */
  revoking?: string
}

/**
 * Signed-in devices, one line each, with a sign-out button except on the
 * current one. The current device comes first, then the most recently used;
 * long lists are cut short until expanded.
 */
export function SessionList({ sessions, onRevoke, revoking }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  if (sessions.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('sessions.none')}</p>
  }
  const sorted = [...sessions].sort(
    (a, b) => Number(b.current) - Number(a.current) || b.lastUsedAt.localeCompare(a.lastUsedAt),
  )
  const shown = expanded ? sorted : sorted.slice(0, COLLAPSED)

  return (
    <div className="space-y-2">
      <ul className="divide-y">
        {shown.map((s) => {
          const { label, device } = describeUserAgent(s.userAgent)
          const Icon = deviceIcons[device]
          return (
            <li key={s.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
              <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                <span className="truncate text-sm font-medium">{label}</span>
                {s.current ? (
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                    {t('sessions.thisDevice')}
                  </span>
                ) : (
                  <span
                    className="text-muted-foreground truncate text-xs"
                    title={t('sessions.signedIn', { date: formatDate(s.createdAt) })}
                  >
                    {[t('sessions.active', { when: formatRelative(s.lastUsedAt) }), s.ip].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              {onRevoke && !s.current && (
                <Button variant="ghost" size="sm" onClick={() => onRevoke(s)} disabled={revoking === s.id}>
                  {revoking === s.id ? t('sessions.signingOut') : t('sessions.signOut')}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {sorted.length > COLLAPSED && (
        <Button variant="link" size="sm" className="px-0" onClick={() => setExpanded(!expanded)}>
          {expanded ? t('sessions.showFewer') : t('sessions.showAll', { count: sorted.length })}
        </Button>
      )}
    </div>
  )
}
