import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useMe } from '@/features/auth/useAuth'
import { cn } from '@/lib/utils'

/** A step in the breadcrumb; the last one is the current page and needs no link. */
export type Crumb = { label: ReactNode; to?: string }

type Props = {
  crumbs: Crumb[]
  /** The page's actions, on the right of the breadcrumb. */
  actions?: ReactNode
  /** Tabs or filters, in the same block under the breadcrumb. */
  children?: ReactNode
  className?: string
}

/**
 * The one header every page uses: sidebar button, breadcrumb and actions, with
 * the page's tabs or filters below, all above a single divider. On phones only
 * the current page's crumb shows.
 */
export function PageHeader({ crumbs, actions, children, className }: Props) {
  const current = crumbs[crumbs.length - 1]?.label
  // Signed-out visitors (public profiles and hikes) have no sidebar to open.
  const signedIn = !!useMe().data

  return (
    <header className={cn('bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur', className)}>
      {/* The breadcrumb stands in for a visible title; screen readers still get a heading. */}
      {typeof current === 'string' && <h1 className="sr-only">{current}</h1>}
      <div className="flex min-h-12 items-center gap-2 px-2 py-1.5 sm:px-4">
        {signedIn && (
          <>
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-center" />
          </>
        )}
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.map((crumb, i) => {
              const last = i === crumbs.length - 1
              return (
                <Fragment key={i}>
                  <BreadcrumbItem className={cn(last ? 'min-w-0' : 'max-sm:hidden')}>
                    {last ? (
                      <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                    ) : crumb.to ? (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.to}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                  </BreadcrumbItem>
                  {!last && <BreadcrumbSeparator className="max-sm:hidden" />}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {children}
    </header>
  )
}
