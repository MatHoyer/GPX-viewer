import { MountainSnow } from 'lucide-react'
import { Link, Outlet } from 'react-router'

import { Button } from '@/components/ui/button'

/** Chrome for pages that signed-out visitors can open, like public profiles. */
export function GuestLayout() {
  return (
    <div className="flex h-svh flex-col">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <Link to="/login" className="flex items-center gap-2 font-semibold">
          <MountainSnow className="size-5" />
          GPX Viewer
        </Link>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register">Create account</Link>
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
