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
import { ApiError } from '@/lib/api'

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
  const remove = useDeleteHikes()
  const one = hikes.length === 1

  function confirm() {
    remove.mutate(
      hikes.map((h) => h.id),
      {
        onSuccess: ({ deleted }) => {
          toast.success(deleted === 1 ? 'Hike deleted' : `${deleted} hikes deleted`)
          onClose()
          onDeleted?.()
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not delete'),
      },
    )
  }

  return (
    <AlertDialog open={hikes.length > 0} onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{one ? 'Delete this hike?' : `Delete ${hikes.length} hikes?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {one
              ? `“${hikes[0].name}” and its GPX file will be permanently removed.`
              : 'They and their GPX files will be permanently removed, with their kudos, comments and tags.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={(e) => {
              // Stay open until the request settles.
              e.preventDefault()
              confirm()
            }}
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
