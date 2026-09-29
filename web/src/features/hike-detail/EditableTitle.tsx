import { Check, Pencil, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAX_NAME_LENGTH, type Hike } from '@/features/hikes/api'
import { useUpdateHike } from '@/features/hikes/useHikes'
import { errorMessage } from '@/lib/errors'

/** Hike name that turns into an input on click; Enter saves, Escape cancels. */
export function EditableTitle({ hike }: { hike: Hike }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<string | null>(null)
  const rename = useUpdateHike()

  function save(e?: FormEvent) {
    e?.preventDefault()
    const name = draft?.trim()
    if (!name || name === hike.name) return setDraft(null)
    rename.mutate(
      { id: hike.id, name },
      {
        onSuccess: () => setDraft(null),
        onError: (err) => toast.error(errorMessage(err, t('hike.renameFailed'))),
      },
    )
  }

  if (draft === null) {
    return (
      <div className="group flex min-w-0 items-center gap-1">
        <h1 className="truncate text-lg leading-tight font-semibold">{hike.name}</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => setDraft(hike.name)}
          aria-label={t('hike.rename')}
        >
          <Pencil />
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={save} className="flex max-w-md items-center gap-1">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        aria-label={t('hike.name')}
        className="h-8 text-base font-semibold"
        disabled={rename.isPending}
      />
      <Button type="submit" size="icon-sm" disabled={!draft.trim() || rename.isPending} aria-label={t('hike.saveName')}>
        <Check />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setDraft(null)} aria-label={t('hike.cancelRename')}>
        <X />
      </Button>
    </form>
  )
}
