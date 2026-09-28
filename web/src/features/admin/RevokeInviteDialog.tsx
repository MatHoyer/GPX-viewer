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
import { ApiError } from '@/lib/api'

import type { AdminUser } from './api'
import { useRevokeInvite } from './useAdmin'

type Props = {
  user: AdminUser | null
  onClose: () => void
}

/** Confirms deleting a pending account, which voids its invite link. */
export function RevokeInviteDialog({ user, onClose }: Props) {
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
        toast.success(`Invite for ${user.email} revoked`)
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog open={user !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this invite?</AlertDialogTitle>
          <AlertDialogDescription>
            The link sent to <span className="text-foreground font-medium break-all">{user?.email}</span> stops working
            and their pending account is deleted. You can invite this email again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {revoke.error && (
          <p role="alert" className="text-destructive text-sm">
            {revoke.error instanceof ApiError ? revoke.error.message : 'Could not revoke the invite'}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={revoke.isPending}>
            {revoke.isPending ? 'Revoking…' : 'Revoke invite'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
