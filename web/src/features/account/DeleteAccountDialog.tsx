import { TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { FloatingInput } from '@/components/ui/floating-input'
import type { User } from '@/features/auth/api'
import { useDeleteAccount } from '@/features/auth/useAuth'
import { ApiError } from '@/lib/api'
import { errorMessage } from '@/lib/errors'

/**
 * Deletes the account after two confirmations: a warning listing what goes,
 * then retyping the email and the password.
 */
export function DeleteAccountDialog({ user }: { user: User }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'warn' | 'confirm'>('warn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const remove = useDeleteAccount()
  const error = remove.error instanceof ApiError ? remove.error : null
  const emailMatches = email.trim().toLowerCase() === user.email.toLowerCase()

  function onOpenChange(next: boolean) {
    if (remove.isPending) return
    setOpen(next)
    if (!next) {
      setStep('warn')
      setEmail('')
      setPassword('')
      remove.reset()
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!emailMatches || !password) return
    remove.mutate(password, { onSuccess: () => toast.success(t('deleteAccount.deleted')) })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">{t('deleteAccount.trigger')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {step === 'warn' ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <TriangleAlert />
              </AlertDialogMedia>
              <AlertDialogTitle>{t('deleteAccount.title')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>{t('deleteAccount.intro')}</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-left">
                    <li>{t('deleteAccount.hikes')}</li>
                    <li>{t('deleteAccount.tags')}</li>
                    <li>{t('deleteAccount.friends')}</li>
                    <li>{t('deleteAccount.interactions')}</li>
                  </ul>
                  <p>{t('deleteAccount.downloadFirst')}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <Button variant="destructive" onClick={() => setStep('confirm')}>
                {t('common.continue')}
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="contents">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('deleteAccount.confirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                <Trans
                  i18nKey="deleteAccount.confirmDescription"
                  values={{ email: user.email }}
                  components={{ email: <span className="text-foreground font-medium break-all" /> }}
                />
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <FloatingInput
                label={t('deleteAccount.yourEmail')}
                type="email"
                autoComplete="off"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <FloatingInput
                label={t('common.password')}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error?.field === 'password' || undefined}
              />
              {remove.error && (
                <p role="alert" className="text-destructive text-sm">
                  {errorMessage(remove.error, t('deleteAccount.failed'))}
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={remove.isPending}>{t('common.cancel')}</AlertDialogCancel>
              <Button
                type="submit"
                className="bg-destructive hover:bg-destructive/80 text-white"
                disabled={!emailMatches || !password || remove.isPending}
              >
                {remove.isPending ? t('common.deleting') : t('deleteAccount.confirm')}
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
