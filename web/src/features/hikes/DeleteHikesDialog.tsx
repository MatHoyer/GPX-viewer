import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { errorMessage } from '@/lib/errors'

import type { Hike } from './api'
import { useDeleteHikes } from './useHikes'

type Props = {
  /** The hikes to delete; the dialog is open while there are some. */
  hikes: Hike[]
  onClose: () => void
  onDeleted?: () => void
}

/** Confirms permanently deleting one or several of your hikes. */
export function DeleteHikesDialog({ hikes, onClose, onDeleted }: Props) {
  const { t } = useTranslation()
  const remove = useDeleteHikes()
  const one = hikes.length === 1

  function confirm() {
    remove.mutate(
      hikes.map((h) => h.id),
      {
        onSuccess: ({ deleted }) => {
          toast.success(t('deleteHikes.deleted', { count: deleted }))
          onClose()
          onDeleted?.()
        },
        onError: (err) => toast.error(errorMessage(err, t('deleteHikes.failed'))),
      },
    )
  }

  return (
    <AlertDialog open={hikes.length > 0} onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteHikes.title', { count: hikes.length })}</AlertDialogTitle>
          <AlertDialogDescription>
            {one ? t('deleteHikes.one', { name: hikes[0].name }) : t('deleteHikes.many')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={(e) => {
              // Stay open until the request settles.
              e.preventDefault()
              confirm()
            }}
          >
            {remove.isPending ? t('common.deleting') : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
