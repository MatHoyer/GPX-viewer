import { NotebookPen, Pencil } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { FloatingTextarea } from '@/components/ui/floating-textarea'
import { MAX_NOTES_LENGTH, type Hike } from '@/features/hikes/api'
import { useUpdateHike } from '@/features/hikes/useHikes'
import { ApiError } from '@/lib/api'

/**
 * A hike's notes as plain text. Its owner gets a pencil to edit them in place,
 * or a single "Add notes" button while there are none.
 */
export function NotesBlock({ hike, isOwner }: { hike: Hike; isOwner: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  const update = useUpdateHike()

  function save() {
    if (draft === null) return
    if (draft.trim() === hike.notes) return setDraft(null)
    update.mutate(
      { id: hike.id, notes: draft },
      {
        onSuccess: () => setDraft(null),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save notes'),
      },
    )
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') setDraft(null)
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
  }

  if (draft !== null) {
    return (
      <div className="space-y-2">
        <FloatingTextarea
          label="Notes"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_NOTES_LENGTH}
          autoFocus
          placeholder="Conditions, company, what to remember next time…"
          className="[&_textarea]:bg-card [&_textarea]:max-h-72"
        />
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground mr-auto hidden text-xs sm:inline">Ctrl+Enter to save, Esc to cancel</span>
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    )
  }

  if (!hike.notes) {
    if (!isOwner) return null
    return (
      <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2" onClick={() => setDraft('')}>
        <NotebookPen />
        Add notes
      </Button>
    )
  }

  return (
    <div className="group relative">
      <p className="text-sm whitespace-pre-wrap">{hike.notes}</p>
      {isOwner && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground absolute -top-1 right-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          onClick={() => setDraft(hike.notes)}
          aria-label="Edit notes"
        >
          <Pencil />
        </Button>
      )}
    </div>
  )
}
