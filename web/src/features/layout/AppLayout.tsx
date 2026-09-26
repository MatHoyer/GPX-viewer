import { Activity, CalendarDays, ChartColumn, Map as MapIcon, MountainSnow, UsersRound } from 'lucide-react'
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar'
import { NavUser } from '@/features/account/NavUser'
import { UploadDialog } from '@/features/hikes/UploadDialog'
import { useConnections } from '@/features/social/useSocial'

const views = [
  { to: '/', label: 'Map', icon: MapIcon },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/stats', label: 'Stats', icon: ChartColumn },
  { to: '/feed', label: 'Activity', icon: Activity },
  { to: '/friends', label: 'Friends', icon: UsersRound },
]

export function AppLayout() {
  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader className="gap-3">
          <div className="flex items-center gap-2 px-2 pt-1 font-semibold">
            <MountainSnow className="size-5" />
            GPX Viewer
            <span className="text-muted-foreground text-xs font-normal tabular-nums">v{__APP_VERSION__}</span>
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
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
      </Sidebar>

      {/* The inset variant adds an m-2 margin from md up, so the height gives it back. */}
      <SidebarInset className="relative h-svh overflow-hidden md:h-[calc(100svh-1rem)]">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}

function ViewNav() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const requests = useConnections().data?.incoming.length ?? 0

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
          {to === '/friends' && requests > 0 && (
            <SidebarMenuBadge aria-label={`${requests} friend requests`}>{requests}</SidebarMenuBadge>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
