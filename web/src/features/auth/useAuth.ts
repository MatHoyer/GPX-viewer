import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchMe, login, logout, register } from './api'

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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: register,
    onSuccess: (user) => qc.setQueryData(meQueryKey, user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.clear()
      qc.setQueryData(meQueryKey, null)
    },
  })
}
