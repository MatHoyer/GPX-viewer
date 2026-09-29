import { Activity, CalendarDays, ChartColumn, Map as MapIcon, MountainSnow, TableProperties, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

// Your own hikes, then what friends share; labels are under nav.
const groups = [
  {
    label: 'yourHikes',
    items: [
      { to: '/', label: 'map', icon: MapIcon },
      { to: '/hikes', label: 'hikes', icon: TableProperties },
      { to: '/calendar', label: 'calendar', icon: CalendarDays },
      { to: '/stats', label: 'stats', icon: ChartColumn },
    ],
  },
  {
    label: 'social',
    items: [
      { to: '/feed', label: 'activity', icon: Activity },
      { to: '/friends', label: 'friends', icon: UsersRound },
    ],
  },
] as const

export function AppLayout() {
  const { t } = useTranslation()
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
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{t(`nav.${group.label}`)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <ViewNav items={group.items} />
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
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

function ViewNav({ items }: { items: (typeof groups)[number]['items'] }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const requests = useConnections().data?.incoming.length ?? 0

  return (
    <SidebarMenu>
      {items.map(({ to, label, icon: Icon }) => (
        <SidebarMenuItem key={to}>
          <SidebarMenuButton asChild isActive={pathname === to}>
            <NavLink to={to} onClick={() => setOpenMobile(false)}>
              <Icon />
              {t(`nav.${label}`)}
            </NavLink>
          </SidebarMenuButton>
          {to === '/friends' && requests > 0 && (
            <SidebarMenuBadge aria-label={t('nav.friendRequests', { count: requests })}>{requests}</SidebarMenuBadge>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
