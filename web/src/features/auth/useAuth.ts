import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import {
  changePassword,
  deleteAccount,
  fetchConfig,
  fetchMe,
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from './api'

export const meQueryKey = ['auth', 'me'] as const

export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: fetchMe, staleTime: Infinity, retry: false })
}

export const configQueryKey = ['config'] as const

export function useConfig() {
  return useQuery({ queryKey: configQueryKey, queryFn: fetchConfig, staleTime: 5 * 60_000 })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: login,
    onSuccess: () => qc.invalidateQueries({ queryKey: meQueryKey }),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: register,
    // The first account closes sign-up when registration is disabled.
    onSettled: () => qc.invalidateQueries({ queryKey: configQueryKey }),
  })
}

export function useVerifyEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: verifyEmail,
    onSuccess: () => qc.invalidateQueries({ queryKey: meQueryKey }),
  })
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset })
}

export function useResetPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resetPassword,
    onSuccess: () => qc.invalidateQueries({ queryKey: meQueryKey }),
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}

export function useLogout() {
  return useSignOut(logout)
}

export function useDeleteAccount() {
  return useSignOut(deleteAccount)
}

/** Runs fn, then leaves for the login page with a cleared cache. */
function useSignOut<T = void>(fn: (input: T) => Promise<void>) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      // Leave first: clearing the cache puts the session back in a pending
      // state, and the guards render nothing while it is pending.
      navigate('/login', { replace: true })
      qc.clear()
      qc.setQueryData(meQueryKey, null)
    },
  })
}
