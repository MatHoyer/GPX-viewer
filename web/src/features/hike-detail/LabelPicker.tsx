import { Check, Plus, Tag, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MAX_LABEL_LENGTH, MAX_LABELS } from '@/features/hikes/api'
import { useLabels } from '@/features/hikes/useHikes'

/** Same normalization as the API: lowercase, single spaces. */
function normalize(label: string) {
  return label.trim().toLowerCase().split(/\s+/).join(' ')
}

type Props = {
  labels: string[]
  /** Read-only when unset. */
  onChange?: (labels: string[]) => void
  disabled?: boolean
}

/** A hike's labels as chips; owners pick from their existing labels or create one. */
export function LabelPicker({ labels, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const known = useLabels()
  const typed = normalize(search).slice(0, MAX_LABEL_LENGTH)
  const all = known.data ?? []
  const canCreate = typed !== '' && !all.includes(typed) && !labels.includes(typed)
  const full = labels.length >= MAX_LABELS

  function toggle(label: string) {
    if (!onChange) return
    onChange(labels.includes(label) ? labels.filter((l) => l !== label) : [...labels, label])
    setSearch('')
  }

  if (!onChange && labels.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((l) => (
        <span
          key={l}
          className="bg-secondary text-secondary-foreground inline-flex h-7 items-center gap-1 rounded-full pr-1 pl-2.5 text-xs font-medium"
        >
          <Tag className="size-3 opacity-60" />
          {l}
          {onChange ? (
            <button
              type="button"
              onClick={() => toggle(l)}
              disabled={disabled}
              aria-label={`Remove label ${l}`}
              className="hover:bg-foreground/10 rounded-full p-0.5"
            >
              <X className="size-3" />
            </button>
          ) : (
            <span className="pr-1.5" />
          )}
        </span>
      ))}
      {onChange && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 rounded-full border-dashed text-xs" disabled={disabled}>
              <Plus />
              Label
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <Command>
              <CommandInput
                value={search}
                onValueChange={setSearch}
                placeholder="Find or create a label…"
                maxLength={MAX_LABEL_LENGTH}
              />
              <CommandList>
                <CommandEmpty>{all.length === 0 ? 'Type to create your first label.' : 'No matching label.'}</CommandEmpty>
                {all.length > 0 && (
                  <CommandGroup heading="Your labels">
                    {all.map((l) => {
                      const on = labels.includes(l)
                      return (
                        <CommandItem key={l} value={l} onSelect={() => toggle(l)} disabled={!on && full}>
                          <Check className={on ? 'opacity-100' : 'opacity-0'} />
                          {l}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )}
                {canCreate && (
                  <CommandGroup forceMount>
                    <CommandItem value={`create:${typed}`} onSelect={() => toggle(typed)} disabled={full} forceMount>
                      <Plus />
                      Create “{typed}”
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
            {full && <p className="text-muted-foreground border-t px-3 py-2 text-xs">At most {MAX_LABELS} labels per hike.</p>}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
