import { useQuery } from '@tanstack/react-query'

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
