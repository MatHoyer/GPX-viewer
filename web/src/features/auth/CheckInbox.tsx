import { MailCheck } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Shown once a link was emailed: after registering, when signing in before the
 * email is verified, or after asking for a password reset.
 */
export function CheckInbox({ email, onBack, children }: { email: string; onBack: () => void; children?: ReactNode }) {
  return (
    <>
      <CardHeader>
        <MailCheck className="text-muted-foreground mb-2 size-8" />
        <CardTitle>Check your inbox</CardTitle>
        <CardDescription>
          {children ?? (
            <>
              We sent a link to <span className="text-foreground font-medium">{email}</span>. Open it to confirm your
              email and sign in. It expires after 24 hours; signing in again after that sends a new one.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-6">
        <Button type="button" variant="outline" size="lg" className="h-11 w-full rounded-xl" onClick={onBack}>
          Back to sign in
        </Button>
      </CardFooter>
    </>
  )
}
