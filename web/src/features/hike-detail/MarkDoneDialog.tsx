import { CalendarCheck, FileUp, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useMarkHikeDone } from '@/features/hikes/useHikes'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Marks a planned hike as walked, optionally with the GPX recorded on the walk. */
export function MarkDoneDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File>()
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const markDone = useMarkHikeDone()

  function pick(list: FileList | null) {
    const f = list?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.gpx')) {
      toast.warning('Only .gpx files are supported')
      return
    }
    setFile(f)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setFile(undefined)
      markDone.reset()
    }
  }

  function submit() {
    markDone.mutate(
      { id, file },
      {
        onSuccess: () => {
          toast.success('Marked as done')
          onOpenChange(false)
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update hike'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarCheck />
          <span className="hidden sm:inline">Mark as done</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as done</DialogTitle>
          <DialogDescription>
            Add the GPX your watch or app recorded to get your own times, speed and heart rate. Without one, the planned
            route is kept as walked.
          </DialogDescription>
        </DialogHeader>

        {file ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span className="truncate">{file.name}</span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setFile(undefined)} aria-label="Remove file">
              <X />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm transition-colors',
              dragging ? 'border-primary bg-muted' : 'hover:bg-muted/50',
            )}
          >
            <FileUp className="size-7" />
            <span>Recorded GPX (optional)</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          hidden
          onChange={(e) => {
            pick(e.target.files)
            e.target.value = ''
          }}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={markDone.isPending}>
            {markDone.isPending ? 'Saving…' : file ? 'Replace route and mark done' : 'Mark as done'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
