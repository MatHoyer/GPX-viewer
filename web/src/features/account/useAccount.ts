import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { User } from '@/features/auth/api'
import { meQueryKey } from '@/features/auth/useAuth'

import { updateAccount } from './api'

// The API returns the updated user, so the cache is set directly.
export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAccount,
    onSuccess: (user: User) => qc.setQueryData(meQueryKey, user),
  })
}
