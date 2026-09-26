import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'

import { MAX_NAME_LENGTH, type Hike } from './api'
import { useRenameHike } from './useHikes'

type Props = {
  hike: Hike | null
  onClose: () => void
}

export function RenameDialog({ hike, onClose }: Props) {
  return (
    <Dialog open={hike !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed so the field resets to the current name each time it opens. */}
        {hike && <RenameForm key={hike.id} hike={hike} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({ hike, onDone }: { hike: Hike; onDone: () => void }) {
  const [name, setName] = useState(hike.name)
  const rename = useRenameHike()
  const trimmed = name.trim()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!trimmed || trimmed === hike.name) return onDone()
    rename.mutate(
      { id: hike.id, name: trimmed },
      {
        onSuccess: () => {
          toast.success('Hike renamed')
          onDone()
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not rename hike'),
      },
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Rename hike</DialogTitle>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="hike-name">Name</Label>
        <Input
          id="hike-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!trimmed || rename.isPending}>
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}
