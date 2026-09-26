import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import {
  changePassword,
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

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: login,
    onSuccess: () => qc.invalidateQueries({ queryKey: meQueryKey }),
  })
}

export function useRegister() {
  return useMutation({ mutationFn: register })
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
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Leave first: clearing the cache puts the session back in a pending
      // state, and the guards render nothing while it is pending.
      navigate('/login', { replace: true })
      qc.clear()
      qc.setQueryData(meQueryKey, null)
    },
  })
}
