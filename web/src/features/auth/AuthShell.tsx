import { MountainSnow } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'

/** Centered, branded card used by the sign-in and email verification pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2 text-lg font-semibold">
          <MountainSnow className="size-6" />
          GPX Viewer
        </div>
        <Card>{children}</Card>
      </div>
    </div>
  )
}
