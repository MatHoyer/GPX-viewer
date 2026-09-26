import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Hike } from '@/features/hikes/api'
import { api } from '@/lib/api'

import type { Profile } from './profile'

export function useHike(id: string) {
  return useQuery({ queryKey: ['hikes', 'detail', id], queryFn: () => api<Hike>(`/hikes/${id}`) })
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: ['hikes', 'profile', id],
    queryFn: () => api<Profile>(`/hikes/${id}/profile`),
    staleTime: Infinity,
  })
}

type Participant = { hikeId: string; userId: string }

// Tags change which hikes show up on whose map and profile, so refresh both.
function useParticipantMutation(method: 'PUT' | 'DELETE') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ hikeId, userId }: Participant) =>
      api<void>(`/hikes/${hikeId}/participants/${userId}`, { method }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['hikes'] }), qc.invalidateQueries({ queryKey: ['social'] })]),
  })
}

export function useTagFriend() {
  return useParticipantMutation('PUT')
}

export function useUntag() {
  return useParticipantMutation('DELETE')
}
