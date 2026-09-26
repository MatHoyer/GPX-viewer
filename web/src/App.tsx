import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SettingsPage } from '@/features/account/SettingsPage'
import { AuthPage } from '@/features/auth/AuthPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { useMe } from '@/features/auth/useAuth'
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage'
import { CalendarPage } from '@/features/calendar/CalendarPage'
import { HikePage } from '@/features/hike-detail/HikePage'
import { MapPage } from '@/features/hikes/MapPage'
import { AppLayout } from '@/features/layout/AppLayout'
import { GuestLayout } from '@/features/layout/GuestLayout'
import { FriendsPage } from '@/features/social/FriendsPage'
import { UserProfilePage } from '@/features/social/UserProfilePage'
import { FeedPage } from '@/features/social/FeedPage'
import { StatsPage } from '@/features/stats/StatsPage'
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
              {/* Not guest-only: emailed links may be opened while signed in as someone else. */}
              <Route path="/verify" element={<VerifyEmailPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route path="/" element={<MapPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/friends" element={<FriendsPage />} />
              </Route>
              {/* Shared with signed-out visitors when the owner's profile is public. */}
              <Route element={<AnyLayout />}>
                <Route path="/u/:id" element={<UserProfilePage />} />
                <Route path="/hikes/:id" element={<HikePage />} />
              </Route>
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

function AnyLayout() {
  const me = useMe()
  if (me.isPending) return null
  return me.data ? <AppLayout /> : <GuestLayout />
}

function GuestOnly({ children }: { children: ReactNode }) {
  const me = useMe()
  if (me.isPending) return null
  if (me.data) return <Navigate to="/" replace />
  return children
}
