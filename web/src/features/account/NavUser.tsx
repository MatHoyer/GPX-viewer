import { ChevronsUpDown, Languages, LogOut, Settings, Shield, SunMoon, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import type { User } from '@/features/auth/api'
import { useLogout, useMe } from '@/features/auth/useAuth'

import { displayName } from './displayName'
import { LanguageSwitcher } from './LanguageSwitcher'
import { settingsSections } from './settingsSections'
import { ThemeSwitcher } from './ThemeSwitcher'
import { UserAvatar } from './UserAvatar'

const itemClass = 'gap-2 px-2 py-2'

export function NavUser() {
  const { t } = useTranslation()
  const me = useMe()
  const logout = useLogout()
  const { isMobile, setOpenMobile } = useSidebar()

  if (!me.data) return null
  const user = me.data

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar user={user} className="h-8 w-8 rounded-lg" />
              <UserSummary user={user} />
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar user={user} className="h-8 w-8 rounded-lg" />
                <UserSummary user={user} />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild className={itemClass}>
                <Link to={`/u/${user.id}`} onClick={() => setOpenMobile(false)}>
                  <UserRound />
                  {t('nav.profile')}
                </Link>
              </DropdownMenuItem>
              {/* Straight to a part of Settings, e.g. to sign out a lost device. */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={itemClass}>
                  <Settings />
                  {t('nav.settings')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-44">
                  {settingsSections.map(({ value, path, icon: Icon }) => (
                    <DropdownMenuItem key={value} asChild className={itemClass}>
                      <Link to={path} onClick={() => setOpenMobile(false)}>
                        <Icon />
                        {t(`settings.sections.${value}`)}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {user.isAdmin && (
                <DropdownMenuItem asChild className={itemClass}>
                  <Link to="/admin" onClick={() => setOpenMobile(false)}>
                    <Shield />
                    {t('nav.admin')}
                  </Link>
                </DropdownMenuItem>
              )}
              <div className="flex items-center gap-2 px-2 py-1 text-sm">
                <SunMoon className="text-muted-foreground size-4" />
                {t('nav.theme')}
                <ThemeSwitcher className="ml-auto" />
              </div>
              <div className="flex items-center gap-2 px-2 py-1 text-sm">
                <Languages className="text-muted-foreground size-4" />
                {t('nav.language')}
                <LanguageSwitcher className="ml-auto" />
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className={itemClass} onClick={() => logout.mutate()}>
              <LogOut />
              {t('nav.logOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function UserSummary({ user }: { user: User }) {
  return (
    <div className="grid flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{displayName(user)}</span>
      <span className="truncate text-xs">{user.email}</span>
    </div>
  )
}
