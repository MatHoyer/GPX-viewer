import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

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
import { errorMessage } from '@/lib/errors'

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
  const { t } = useTranslation()
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
              <DialogTitle>{reset ? t('admin.passwordLink') : user ? t('admin.newInviteLink') : t('admin.accountCreated')}</DialogTitle>
              <DialogDescription>
                {invite.emailSent
                  ? t('admin.linkEmailed', { email: recipient })
                  : sendEmail
                    ? t('admin.linkEmailFailed', { email: recipient })
                    : t('admin.linkShare', { email: recipient })}{' '}
                {reset ? t('admin.linkExpiresDay') : t('admin.linkExpiresWeek')}
              </DialogDescription>
            </DialogHeader>
            <InviteLink link={invite.inviteLink} />
            <DialogFooter>
              <Button onClick={() => changeOpen(false)}>{t('admin.done')}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="contents">
            <DialogHeader>
              <DialogTitle>
                {reset
                  ? t('admin.passwordLinkFor', { name: displayName(user) })
                  : user
                    ? t('admin.inviteAgain', { name: displayName(user) })
                    : t('admin.inviteSomeone')}
              </DialogTitle>
              <DialogDescription>
                {reset
                  ? t('admin.passwordLinkDescription')
                  : user
                    ? t('admin.inviteAgainDescription')
                    : t('admin.inviteDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!user && (
                <>
                  <FloatingInput
                    label={t('common.email')}
                    type="email"
                    autoComplete="off"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={error?.field === 'email' || undefined}
                  />
                  <FloatingInput
                    label={t('admin.displayNameOptional')}
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
                  {recipient ? t('admin.emailLinkTo', { email: recipient }) : t('admin.emailLink')}
                </label>
              )}
              {mutation.error && (
                <p role="alert" className="text-destructive text-sm">
                  {errorMessage(mutation.error, t('admin.inviteFailed'))}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={mutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
                {user ? t('admin.createLink') : t('common.createAccount')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
