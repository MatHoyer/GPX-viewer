import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Person } from '@/features/account/displayName'
import { api } from '@/lib/api'

/** Mirrors the API limit on comments. */
export const MAX_COMMENT_LENGTH = 2000

export type Comment = { id: string; body: string; createdAt: string; author?: Person }

// Kudos and comment counts show on the hike page and in the feed, both under ['hikes'].
function useInvalidateHikes() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['hikes'] })
}

export function useKudos() {
  const invalidate = useInvalidateHikes()
  return useMutation({
    mutationFn: ({ hikeId, on }: { hikeId: string; on: boolean }) =>
      api<void>(`/hikes/${hikeId}/kudos`, { method: on ? 'PUT' : 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useComments(hikeId: string) {
  return useQuery({ queryKey: ['hikes', 'comments', hikeId], queryFn: () => api<Comment[]>(`/hikes/${hikeId}/comments`) })
}

export function usePostComment(hikeId: string) {
  const invalidate = useInvalidateHikes()
  return useMutation({
    mutationFn: (body: string) => api<Comment>(`/hikes/${hikeId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
    onSuccess: invalidate,
  })
}

export function useDeleteComment(hikeId: string) {
  const invalidate = useInvalidateHikes()
  return useMutation({
    mutationFn: (commentId: string) => api<void>(`/hikes/${hikeId}/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
