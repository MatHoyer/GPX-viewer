import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'

import { SessionList } from './SessionList'
import { useMySessions, useRevokeMyOtherSessions, useRevokeMySession } from './useSessions'

/** The devices you are signed in on, for Settings. */
export function SessionsCard() {
  const sessions = useMySessions()
  const revoke = useRevokeMySession()
  const revokeOthers = useRevokeMyOtherSessions()
  const others = sessions.data?.filter((s) => !s.current).length ?? 0
  const onError = (fallback: string) => (err: Error) => toast.error(err instanceof ApiError ? err.message : fallback)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>Devices signed in to your account. Sign out any you don't recognise.</CardDescription>
        {others > 0 && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={revokeOthers.isPending}
              onClick={() =>
                revokeOthers.mutate(undefined, {
                  onSuccess: () => toast.success('Signed out of your other devices'),
                  onError: onError('Could not sign out your other devices'),
                })
              }
            >
              Sign out others
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {sessions.data ? (
          <SessionList
            sessions={sessions.data}
            revoking={revoke.isPending ? revoke.variables : undefined}
            onRevoke={(s) => revoke.mutate(s.id, { onError: onError('Could not sign out that device') })}
          />
        ) : sessions.isError ? (
          <p role="alert" className="text-destructive text-sm">
            Could not load your sessions.
          </p>
        ) : (
          <Skeleton className="h-12" />
        )}
      </CardContent>
    </Card>
  )
}
