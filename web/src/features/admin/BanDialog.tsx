import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FloatingTextarea } from '@/components/ui/floating-textarea'
import { displayName } from '@/features/account/displayName'
import { ApiError } from '@/lib/api'
import { errorMessage } from '@/lib/errors'

import { MAX_BAN_REASON_LENGTH, type AdminUser } from './api'
import { useBanUser } from './useAdmin'

type Props = {
  user: AdminUser | null
  onClose: () => void
}

/** Asks for the reason the banned user will see when they try to sign in. */
export function BanDialog({ user, onClose }: Props) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const ban = useBanUser()
  const error = ban.error instanceof ApiError ? ban.error : null

  function onOpenChange(open: boolean) {
    if (open || ban.isPending) return
    setReason('')
    ban.reset()
    onClose()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !reason.trim()) return
    ban.mutate(
      { id: user.id, reason },
      {
        onSuccess: () => {
          toast.success(t('admin.banned', { name: displayName(user) }))
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>{t('admin.banTitle', { name: user ? displayName(user) : '' })}</DialogTitle>
            <DialogDescription>
              {t('admin.banDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <FloatingTextarea
              id="ban-reason"
              label={t('admin.reason')}
              description={t('admin.reasonHint')}
              required
              autoFocus
              maxLength={MAX_BAN_REASON_LENGTH}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={error?.field === 'reason' || undefined}
            />
            {ban.error && (
              <p role="alert" className="text-destructive text-sm">
                {errorMessage(ban.error, t('admin.banFailed'))}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={ban.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={!reason.trim() || ban.isPending}>
              {ban.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {t('admin.ban')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
