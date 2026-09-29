import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/errors'

import { SessionList } from './SessionList'
import { useMySessions, useRevokeMyOtherSessions, useRevokeMySession } from './useSessions'

/** The devices you are signed in on, for Settings. */
export function SessionsCard() {
  const { t } = useTranslation()
  const sessions = useMySessions()
  const revoke = useRevokeMySession()
  const revokeOthers = useRevokeMyOtherSessions()
  const others = sessions.data?.filter((s) => !s.current).length ?? 0
  const onError = (fallback: string) => (err: Error) => toast.error(errorMessage(err, fallback))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sessions.title')}</CardTitle>
        <CardDescription>{t('sessions.description')}</CardDescription>
        {others > 0 && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={revokeOthers.isPending}
              onClick={() =>
                revokeOthers.mutate(undefined, {
                  onSuccess: () => toast.success(t('sessions.signedOutOthers')),
                  onError: onError(t('sessions.signOutOthersFailed')),
                })
              }
            >
              {t('sessions.signOutOthers')}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {sessions.data ? (
          <SessionList
            sessions={sessions.data}
            revoking={revoke.isPending ? revoke.variables : undefined}
            onRevoke={(s) => revoke.mutate(s.id, { onError: onError(t('sessions.signOutFailed')) })}
          />
        ) : sessions.isError ? (
          <p role="alert" className="text-destructive text-sm">
            {t('sessions.loadFailed')}
          </p>
        ) : (
          <Skeleton className="h-12" />
        )}
      </CardContent>
    </Card>
  )
}
