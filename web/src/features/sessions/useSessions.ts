import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchMySessions, revokeMyOtherSessions, revokeMySession } from './api'

const mySessionsQueryKey = ['me', 'sessions'] as const

export function useMySessions() {
  return useQuery({ queryKey: mySessionsQueryKey, queryFn: fetchMySessions })
}

function useSessionsMutation<T>(fn: (input: T) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: mySessionsQueryKey }),
  })
}

export const useRevokeMySession = () => useSessionsMutation(revokeMySession)
export const useRevokeMyOtherSessions = () => useSessionsMutation(revokeMyOtherSessions)
