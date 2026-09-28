import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { banUser, createUser, fetchUsers, reissueInvite, setAdmin, unbanUser } from './api'

const usersQueryKey = ['admin', 'users'] as const

export function useUsers() {
  return useQuery({ queryKey: usersQueryKey, queryFn: fetchUsers })
}

/** Wraps a mutation that changes users so the list refreshes after it. */
function useUsersMutation<T, R>(fn: (input: T) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: usersQueryKey }),
  })
}

export const useCreateUser = () => useUsersMutation(createUser)
export const useReissueInvite = () => useUsersMutation(reissueInvite)
export const useBanUser = () => useUsersMutation(banUser)
export const useUnbanUser = () => useUsersMutation(unbanUser)
export const useSetAdmin = () => useUsersMutation(setAdmin)
