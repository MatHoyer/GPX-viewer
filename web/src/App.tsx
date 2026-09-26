import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthPage } from '@/features/auth/AuthPage'
import { useMe } from '@/features/auth/useAuth'
import { CalendarPage } from '@/features/calendar/CalendarPage'
import { HikePage } from '@/features/hike-detail/HikePage'
import { MapPage } from '@/features/hikes/MapPage'
import { AppLayout } from '@/features/layout/AppLayout'
import { ApiError } from '@/lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
              <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
              <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route path="/" element={<MapPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
              </Route>
              <Route path="/hikes/:id" element={<RequireAuth><HikePage /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-center" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe()
  if (me.isPending) return null
  if (!me.data) return <Navigate to="/login" replace />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const me = useMe()
  if (me.isPending) return null
  if (me.data) return <Navigate to="/" replace />
  return children
}
