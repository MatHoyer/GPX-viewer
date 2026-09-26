import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addFriend,
  getConnections,
  getUserProfile,
  getUserTracks,
  listUserHikes,
  removeFriend,
} from './api'

// Everything under one prefix: a friendship change can alter any of it.
const keys = {
  all: ['social'] as const,
  profile: (id: string) => ['social', 'profile', id] as const,
  hikes: (id: string) => ['social', 'hikes', id] as const,
  tracks: (id: string) => ['social', 'tracks', id] as const,
  friends: ['social', 'friends'] as const,
}

export function useUserProfile(id: string | undefined) {
  return useQuery({ queryKey: keys.profile(id ?? ''), queryFn: () => getUserProfile(id!), enabled: !!id })
}

export function useUserHikes(id: string, enabled: boolean) {
  return useQuery({ queryKey: keys.hikes(id), queryFn: () => listUserHikes(id), enabled })
}

export function useUserTracks(id: string, enabled: boolean) {
  return useQuery({ queryKey: keys.tracks(id), queryFn: () => getUserTracks(id), enabled })
}

export function useConnections() {
  return useQuery({ queryKey: keys.friends, queryFn: getConnections })
}

function useSocialMutation<T>(mutationFn: (id: string) => Promise<T>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) })
}

export function useAddFriend() {
  return useSocialMutation(addFriend)
}

export function useRemoveFriend() {
  return useSocialMutation(removeFriend)
}
