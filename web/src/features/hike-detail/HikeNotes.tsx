import { X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MAX_LABEL_LENGTH,
  MAX_LABELS,
  MAX_NOTES_LENGTH,
  type Hike,
  type HikeUpdate,
} from '@/features/hikes/api'
import { useLabels, useUpdateHike } from '@/features/hikes/useHikes'
import { ApiError } from '@/lib/api'

/** A hike's labels and notes: editable by its owner, read-only for others and hidden when empty. */
export function HikeNotes({ hike, isOwner }: { hike: Hike; isOwner: boolean }) {
  const update = useUpdateHike()

  function save(patch: HikeUpdate) {
    update.mutate(
      { id: hike.id, ...patch },
      {
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save changes'),
      },
    )
  }

  if (!isOwner) {
    if (!hike.notes && hike.labels.length === 0) return null
    return (
      <section className="bg-card space-y-3 rounded-xl border p-4">
        {hike.labels.length > 0 && <Labels labels={hike.labels} />}
        {hike.notes && <p className="text-sm whitespace-pre-wrap">{hike.notes}</p>}
      </section>
    )
  }

  return (
    <section className="bg-card space-y-3 rounded-xl border p-4">
      <LabelEditor labels={hike.labels} disabled={update.isPending} onChange={(labels) => save({ labels })} />
      {/* Keyed so the draft resets when the saved notes change. */}
      <NotesEditor key={hike.notes} notes={hike.notes} saving={update.isPending} onSave={save} />
    </section>
  )
}

function Labels({ labels, onRemove }: { labels: string[]; onRemove?: (label: string) => void }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Labels">
      {labels.map((l) => (
        <li key={l} className="bg-secondary text-secondary-foreground flex items-center gap-0.5 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium">
          {l}
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(l)}
              aria-label={`Remove label ${l}`}
              className="hover:bg-foreground/10 rounded-full p-0.5"
            >
              <X className="size-3" />
            </button>
          ) : (
            <span className="pr-1.5" />
          )}
        </li>
      ))}
    </ul>
  )
}

function LabelEditor({
  labels,
  disabled,
  onChange,
}: {
  labels: string[]
  disabled: boolean
  onChange: (labels: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const known = useLabels()
  const suggestions = (known.data ?? []).filter((l) => !labels.includes(l))
  const full = labels.length >= MAX_LABELS

  function add() {
    const label = draft.trim().toLowerCase().split(/\s+/).join(' ')
    setDraft('')
    if (label && !labels.includes(label)) onChange([...labels, label])
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !draft && labels.length > 0) {
      onChange(labels.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {labels.length > 0 && <Labels labels={labels} onRemove={(l) => onChange(labels.filter((x) => x !== l))} />}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        list={listId}
        maxLength={MAX_LABEL_LENGTH}
        disabled={disabled || full}
        placeholder={full ? `At most ${MAX_LABELS} labels` : 'Add a label…'}
        aria-label="Add a label"
        className="h-7 w-40 text-xs md:text-xs"
      />
      <datalist id={listId}>
        {suggestions.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
    </div>
  )
}

function NotesEditor({
  notes,
  saving,
  onSave,
}: {
  notes: string
  saving: boolean
  onSave: (patch: HikeUpdate) => void
}) {
  const [draft, setDraft] = useState(notes)
  const dirty = draft.trim() !== notes

  return (
    <div className="space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={MAX_NOTES_LENGTH}
        rows={Math.min(10, Math.max(2, draft.split('\n').length))}
        placeholder="Add notes: conditions, company, what to remember next time…"
        aria-label="Notes"
        className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-y rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
      />
      {dirty && (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDraft(notes)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave({ notes: draft })} disabled={saving}>
            {saving ? 'Saving…' : 'Save notes'}
          </Button>
        </div>
      )}
    </div>
  )
}
