import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { User } from '@/features/auth/api'
import { meQueryKey } from '@/features/auth/useAuth'

import { deleteAvatar, updateAccount, uploadAvatar } from './api'

// Every account mutation returns the updated user, so the cache is set directly.
function useAccountMutation<T>(mutationFn: (arg: T) => Promise<User>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (user) => qc.setQueryData(meQueryKey, user),
  })
}

export function useUpdateAccount() {
  return useAccountMutation(updateAccount)
}

export function useUploadAvatar() {
  return useAccountMutation(uploadAvatar)
}

export function useDeleteAvatar() {
  return useAccountMutation(deleteAvatar)
}
