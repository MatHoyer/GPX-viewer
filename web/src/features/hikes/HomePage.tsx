import { LogOut, Monitor, Moon, MountainSnow, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { useLogout, useMe } from '@/features/auth/useAuth'
import { formatDistance, formatElevation } from '@/lib/format'

import type { Hike } from './api'
import { HikeList } from './HikeList'
import type { PopupState } from './HikePopup'
import { HikesMap } from './HikesMap'
import { RenameDialog } from './RenameDialog'
import { UploadDialog } from './UploadDialog'
import { useDeleteHike, useHikes, useTracks } from './useHikes'

export function HomePage() {
  const hikes = useHikes()
  const tracks = useTracks()
  const deleteHike = useDeleteHike()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Hike | null>(null)
  const [renaming, setRenaming] = useState<Hike | null>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const nonce = useRef(0)

  function openPopup(hikeId: string, longitude: number, latitude: number) {
    setSelectedId(hikeId)
    setPopup({ hikeId, longitude, latitude, nonce: ++nonce.current })
  }

  function closePopup(closedNonce: number) {
    setPopup((p) => (p?.nonce === closedNonce ? null : p))
  }

  function selectFromList(id: string | null) {
    const start = id ? tracks.data?.features.find((f) => f.properties.id === id)?.geometry.coordinates[0]?.[0] : null
    if (id && start) {
      openPopup(id, start[0], start[1])
    } else {
      setSelectedId(id)
      setPopup(null)
    }
  }

  const totals = useMemo(() => {
    const list = hikes.data ?? []
    return {
      count: list.length,
      distance: list.reduce((s, h) => s + h.distanceM, 0),
      elevation: list.reduce((s, h) => s + h.elevationGainM, 0),
    }
  }, [hikes.data])

  function confirmDelete() {
    if (!pendingDelete) return
    const hike = pendingDelete
    deleteHike.mutate(hike.id, {
      onSuccess: () => {
        if (selectedId === hike.id) setSelectedId(null)
        if (popup?.hikeId === hike.id) setPopup(null)
        toast.success(`Deleted “${hike.name}”`)
      },
      onError: () => toast.error('Could not delete hike'),
    })
    setPendingDelete(null)
  }

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
            <SidebarGroupLabel>
              {totals.count > 0
                ? `${totals.count} hikes · ${formatDistance(totals.distance)} · ${formatElevation(totals.elevation)} D+`
                : 'Hikes'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <HikeList
                hikes={hikes.data}
                isLoading={hikes.isLoading}
                selectedId={selectedId}
                onSelect={selectFromList}
                onHover={setHoveredId}
                onRename={setRenaming}
                onDelete={setPendingDelete}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <AccountMenu />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="relative h-svh overflow-hidden">
        <SidebarTrigger className="bg-background absolute top-2 left-2 z-10 shadow-sm" variant="outline" />
        <HikesMap
          hikes={hikes.data ?? []}
          tracks={tracks.data}
          selectedId={selectedId}
          hoveredId={hoveredId}
          popup={popup}
          onRouteClick={openPopup}
          onHover={setHoveredId}
          onPopupClose={closePopup}
        />
      </SidebarInset>

      <RenameDialog hike={renaming} onClose={() => setRenaming(null)} />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this hike?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” and its GPX file will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}

function AccountMenu() {
  const me = useMe()
  const logout = useLogout()
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start truncate">
          {me.data?.email}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor /> System
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout.mutate()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
