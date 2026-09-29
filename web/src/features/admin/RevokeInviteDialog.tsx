import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'

import type { AdminUser } from './api'
import { useRevokeInvite } from './useAdmin'

type Props = {
  user: AdminUser | null
  onClose: () => void
  /** Called once the account is gone. */
  onRevoked?: () => void
}

/** Confirms deleting a pending account, which voids its invite link. */
export function RevokeInviteDialog({ user, onClose, onRevoked }: Props) {
  const { t } = useTranslation()
  const revoke = useRevokeInvite()

  function onOpenChange(open: boolean) {
    if (open || revoke.isPending) return
    revoke.reset()
    onClose()
  }

  function onConfirm() {
    if (!user) return
    revoke.mutate(user.id, {
      onSuccess: () => {
        toast.success(t('admin.inviteRevoked', { email: user.email }))
        onClose()
        onRevoked?.()
      },
    })
  }

  return (
    <AlertDialog open={user !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('admin.revokeTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            <Trans
              i18nKey="admin.revokeDescription"
              values={{ email: user?.email }}
              components={{ email: <span className="text-foreground font-medium break-all" /> }}
            />
          </AlertDialogDescription>
        </AlertDialogHeader>
        {revoke.error && (
          <p role="alert" className="text-destructive text-sm">
            {errorMessage(revoke.error, t('admin.revokeFailed'))}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>{t('common.cancel')}</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={revoke.isPending}>
            {revoke.isPending ? t('admin.revoking') : t('admin.revoke')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
