import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  banUser,
  createUser,
  fetchUser,
  fetchUsers,
  fetchUserSessions,
  passwordLink,
  revokeInvite,
  revokeUserSession,
  revokeUserSessions,
  setAdmin,
  setEmailVerified,
  unbanUser,
} from './api'

// Every admin query lives under this key, so any change refreshes them all.
const adminUsersKey = ['admin', 'users'] as const

export function useUsers(q: string, page: number) {
  return useQuery({
    queryKey: [...adminUsersKey, 'list', q, page],
    queryFn: () => fetchUsers({ q, page }),
    placeholderData: keepPreviousData,
  })
}

export function useUser(id: string) {
  return useQuery({ queryKey: [...adminUsersKey, id], queryFn: () => fetchUser(id) })
}

export function useUserSessions(id: string) {
  return useQuery({ queryKey: [...adminUsersKey, id, 'sessions'], queryFn: () => fetchUserSessions(id) })
}

/** Wraps a mutation that changes users so the admin views refresh after it. */
function useUsersMutation<T, R>(fn: (input: T) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: adminUsersKey }),
  })
}

export const useCreateUser = () => useUsersMutation(createUser)
export const usePasswordLink = () => useUsersMutation(passwordLink)
export const useRevokeInvite = () => useUsersMutation(revokeInvite)
export const useBanUser = () => useUsersMutation(banUser)
export const useUnbanUser = () => useUsersMutation(unbanUser)
export const useSetAdmin = () => useUsersMutation(setAdmin)
export const useRevokeUserSession = () => useUsersMutation(revokeUserSession)
export const useRevokeUserSessions = () => useUsersMutation(revokeUserSessions)
export const useSetEmailVerified = () => useUsersMutation(setEmailVerified)
