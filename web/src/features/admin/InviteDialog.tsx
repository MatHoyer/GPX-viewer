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
import { useConfig } from '@/features/auth/useAuth'
import { ApiError } from '@/lib/api'

import type { AdminUser, Invite } from './api'
import { InviteLink } from './InviteLink'
import { useCreateUser, usePasswordLink } from './useAdmin'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Issues a new link for this user instead of creating an account: their
   * invite while it is pending, otherwise a password reset.
   */
  user?: AdminUser
}

/**
 * Creates an account for someone, or a new password link for a user, then
 * shows the link to copy. With a mail server, it can also be emailed.
 */
export function InviteDialog({ open, onOpenChange, user }: Props) {
  const emailEnabled = useConfig().data?.emailEnabled ?? false
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [wantsEmail, setWantsEmail] = useState(true)
  const sendEmail = emailEnabled && wantsEmail
  const [invite, setInvite] = useState<Invite | null>(null)
  const create = useCreateUser()
  const reissue = usePasswordLink()
  const mutation = user ? reissue : create
  const error = mutation.error instanceof ApiError ? mutation.error : null
  const recipient = user?.email ?? email.trim()
  // An accepted user gets a password reset link rather than an invite.
  const reset = user !== undefined && !user.invitedAt

  function changeOpen(next: boolean) {
    if (mutation.isPending) return
    onOpenChange(next)
    if (!next) {
      setEmail('')
      setName('')
      setWantsEmail(true)
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
              <DialogTitle>{reset ? 'Password link' : user ? 'New invite link' : 'Account created'}</DialogTitle>
              <DialogDescription>
                {invite.emailSent
                  ? `We emailed this link to ${recipient}. You can also share it yourself.`
                  : sendEmail
                    ? `The email to ${recipient} could not be sent. Share this link with them instead.`
                    : `Share this link with ${recipient} so they can choose a password.`}{' '}
                It works once and expires in {reset ? '24 hours' : '7 days'}.
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
              <DialogTitle>
                {reset ? `Password link for ${displayName(user)}` : user ? `Invite ${displayName(user)} again` : 'Invite someone'}
              </DialogTitle>
              <DialogDescription>
                {reset
                  ? 'A link to choose a new password, for when they forgot theirs. Their current password keeps working until they use it.'
                  : user
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
              {emailEnabled && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={wantsEmail}
                    onChange={(e) => setWantsEmail(e.target.checked)}
                  />
                  Email the link to {recipient || 'them'}
                </label>
              )}
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
                {user ? 'Create link' : 'Create account'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
