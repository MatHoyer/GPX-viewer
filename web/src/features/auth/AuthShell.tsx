import { MountainSnow } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { LanguageSwitcher } from '@/features/account/LanguageSwitcher'

/** Centered, branded card used by the sign-in and email verification pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* A full page load: the home page is served by the server, not the app. */}
        <a href="/" className="flex items-center justify-center gap-2 text-lg font-semibold">
          <MountainSnow className="size-6" />
          GPX Viewer
        </a>
        <Card>{children}</Card>
        <LanguageSwitcher className="mx-auto" />
      </div>
    </div>
  )
}
