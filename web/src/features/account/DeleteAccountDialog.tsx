import { TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
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

/**
 * Deletes the account after two confirmations: a warning listing what goes,
 * then retyping the email and the password.
 */
export function DeleteAccountDialog({ user }: { user: User }) {
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
    remove.mutate(password, { onSuccess: () => toast.success('Your account was deleted') })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete my account</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {step === 'warn' ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <TriangleAlert />
              </AlertDialogMedia>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>This permanently deletes, with no way back:</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-left">
                    <li>all your hikes and planned routes, with their GPX files</li>
                    <li>your tags on friends' hikes</li>
                    <li>your friends and friend requests</li>
                    <li>your kudos and comments, and those on your hikes</li>
                  </ul>
                  <p>Download your hikes first if you want to keep them.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={() => setStep('confirm')}>
                Continue
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="contents">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                Type <span className="text-foreground font-medium break-all">{user.email}</span> and your password to
                delete your account for good.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <FloatingInput
                label="Your email"
                type="email"
                autoComplete="off"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <FloatingInput
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error?.field === 'password' || undefined}
              />
              {remove.error && (
                <p role="alert" className="text-destructive text-sm">
                  {error?.message ?? 'Could not delete your account'}
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
              <Button
                type="submit"
                className="bg-destructive hover:bg-destructive/80 text-white"
                disabled={!emailMatches || !password || remove.isPending}
              >
                {remove.isPending ? 'Deleting…' : 'Delete my account forever'}
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
