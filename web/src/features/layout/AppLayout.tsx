import { CalendarDays, Map as MapIcon, MountainSnow } from 'lucide-react'
import { useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar'
import { NavUser } from '@/features/account/NavUser'
import { UploadDialog } from '@/features/hikes/UploadDialog'
import { useHikes } from '@/features/hikes/useHikes'
import { formatDistance, formatElevation } from '@/lib/format'

const views = [
  { to: '/', label: 'Map', icon: MapIcon },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
]

export function AppLayout() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="gap-3">
          <div className="flex items-center gap-2 px-2 pt-1 font-semibold">
            <MountainSnow className="size-5" />
            GPX Viewer
          </div>
          <UploadDialog />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Views</SidebarGroupLabel>
            <SidebarGroupContent>
              <ViewNav />
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>All time</SidebarGroupLabel>
            <SidebarGroupContent>
              <Totals />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="relative h-svh overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}

function ViewNav() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenu>
      {views.map(({ to, label, icon: Icon }) => (
        <SidebarMenuItem key={to}>
          <SidebarMenuButton asChild isActive={pathname === to}>
            <NavLink to={to} onClick={() => setOpenMobile(false)}>
              <Icon />
              {label}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

function Totals() {
  const hikes = useHikes()
  const totals = useMemo(() => {
    const list = hikes.data ?? []
    return {
      count: list.length,
      distance: list.reduce((s, h) => s + h.distanceM, 0),
      elevation: list.reduce((s, h) => s + h.elevationGainM, 0),
    }
  }, [hikes.data])

  if (!hikes.isLoading && totals.count === 0) {
    return <p className="text-muted-foreground px-2 py-2 text-sm">No hikes yet. Import GPX files to get started.</p>
  }

  return (
    <dl className="grid grid-cols-3 gap-2 px-2 text-center">
      <Stat label="Hikes" value={hikes.isLoading ? '…' : String(totals.count)} />
      <Stat label="Distance" value={hikes.isLoading ? '…' : formatDistance(totals.distance)} />
      <Stat label="D+" value={hikes.isLoading ? '…' : formatElevation(totals.elevation)} />
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-sidebar-accent/60 rounded-md px-1 py-1.5">
      <dt className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}
