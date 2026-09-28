import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

/** An invite link to hand over, with a copy button. */
export function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(link).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => toast.error('Could not copy the link'),
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="bg-muted min-w-0 flex-1 truncate rounded-md px-3 py-2 font-mono text-sm select-all">{link}</code>
      <Button variant="outline" onClick={copy}>
        {copied ? <Check /> : <Copy />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
