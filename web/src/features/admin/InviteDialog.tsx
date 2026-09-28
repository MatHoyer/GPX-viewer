import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FloatingInput } from '@/components/ui/floating-input'
import { displayName } from '@/features/account/displayName'
import { MAX_NAME_LENGTH } from '@/features/account/api'
import { ApiError } from '@/lib/api'

import type { AdminUser, Invite } from './api'
import { InviteLink } from './InviteLink'
import { useCreateUser, useReissueInvite } from './useAdmin'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Issues a new link for this user instead of creating an account. */
  user?: AdminUser
}

/**
 * Creates an account for someone, or a new link for a user who has not signed
 * in yet, then shows the link to copy. It can also be emailed.
 */
export function InviteDialog({ open, onOpenChange, user }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [invite, setInvite] = useState<Invite | null>(null)
  const create = useCreateUser()
  const reissue = useReissueInvite()
  const mutation = user ? reissue : create
  const error = mutation.error instanceof ApiError ? mutation.error : null
  const recipient = user?.email ?? email.trim()

  function changeOpen(next: boolean) {
    if (mutation.isPending) return
    onOpenChange(next)
    if (!next) {
      setEmail('')
      setName('')
      setSendEmail(true)
      setInvite(null)
      create.reset()
      reissue.reset()
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (user) reissue.mutate({ id: user.id, sendEmail }, { onSuccess: setInvite })
    else create.mutate({ email, name, sendEmail }, { onSuccess: setInvite })
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        {invite ? (
          <>
            <DialogHeader>
              <DialogTitle>{user ? 'New invite link' : 'Account created'}</DialogTitle>
              <DialogDescription>
                {invite.emailSent
                  ? `We emailed this link to ${recipient}. You can also share it yourself.`
                  : sendEmail
                    ? `The email to ${recipient} could not be sent. Share this link with them instead.`
                    : `Share this link with ${recipient} so they can choose a password.`}{' '}
                It works once and expires in 7 days.
              </DialogDescription>
            </DialogHeader>
            <InviteLink link={invite.inviteLink} />
            <DialogFooter>
              <Button onClick={() => changeOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="contents">
            <DialogHeader>
              <DialogTitle>{user ? `Invite ${displayName(user)} again` : 'Invite someone'}</DialogTitle>
              <DialogDescription>
                {user
                  ? 'Their previous link stops working.'
                  : 'Creates their account, even when sign-up is closed. They choose a password through the invite link.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!user && (
                <>
                  <FloatingInput
                    label="Email"
                    type="email"
                    autoComplete="off"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={error?.field === 'email' || undefined}
                  />
                  <FloatingInput
                    label="Display name (optional)"
                    autoComplete="off"
                    maxLength={MAX_NAME_LENGTH}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={error?.field === 'name' || undefined}
                  />
                </>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                />
                Email the link to {recipient || 'them'}
              </label>
              {mutation.error && (
                <p role="alert" className="text-destructive text-sm">
                  {error?.message ?? 'Could not create the invite'}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
                {user ? 'Create new link' : 'Create account'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
