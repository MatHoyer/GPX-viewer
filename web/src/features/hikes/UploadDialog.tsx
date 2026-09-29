import { FileUp, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
import { errorMessage } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { useUploadHikes } from './useHikes'

export function UploadDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [planned, setPlanned] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadHikes()

  function addFiles(list: FileList | null) {
    if (!list) return
    const gpx = Array.from(list).filter((f) => f.name.toLowerCase().endsWith('.gpx'))
    if (gpx.length < list.length) toast.warning(t('upload.onlyGpx'))
    setFiles((prev) => [...prev, ...gpx])
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setFiles([])
      setPlanned(false)
      upload.reset()
    }
  }

  function submit() {
    upload.mutate({ files, planned }, {
      onSuccess: (results) => {
        const ok = results.filter((r) => r.hike).length
        const failed = results.filter((r) => r.error)
        if (ok > 0) toast.success(t(planned ? 'upload.importedPlanned' : 'upload.imported', { count: ok }))
        for (const f of failed) toast.error(`${f.filename}: ${f.error}`)
        onOpenChange(false)
      },
      onError: (err) => toast.error(errorMessage(err, t('upload.failed'))),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Upload />
          {t('upload.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('upload.title')}</DialogTitle>
          <DialogDescription>{t('upload.description')}</DialogDescription>
        </DialogHeader>

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
            'text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-sm transition-colors',
            dragging ? 'border-primary bg-muted' : 'hover:bg-muted/50',
          )}
        >
          <FileUp className="size-8" />
          <span>{t('upload.drop')}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {files.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex justify-between gap-2">
                <span className="truncate">{f.name}</span>
                <span className="text-muted-foreground shrink-0">{formatNumber(Math.round(f.size / 1024))} KB</span>
              </li>
            ))}
          </ul>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={planned} onChange={(e) => setPlanned(e.target.checked)} className="accent-primary mt-0.5" />
          <span>
            {t('upload.planned')}
            <span className="text-muted-foreground block text-xs">{t('upload.plannedHint')}</span>
          </span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={files.length === 0 || upload.isPending}>
            {upload.isPending ? t('upload.importing') : files.length ? t('upload.importCount', { count: files.length }) : t('upload.import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
