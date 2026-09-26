import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { hikeSummits, listSummits } from '@/features/stats/summits'

import { deleteHike, getTiles, getTracks, listHikes, listLabels, updateHike, uploadHikes } from './api'

const keys = {
  all: ['hikes'] as const,
  list: ['hikes', 'list'] as const,
  tracks: ['hikes', 'tracks'] as const,
  labels: ['hikes', 'labels'] as const,
  tiles: ['hikes', 'tiles'] as const,
  summits: ['hikes', 'summits'] as const,
}

export function useHikes() {
  return useQuery({ queryKey: keys.list, queryFn: listHikes })
}

export function useTracks() {
  return useQuery({ queryKey: keys.tracks, queryFn: getTracks })
}

/** The signed-in user's explored tiles by hike; fetched only when `enabled`. */
export function useTiles(enabled = true) {
  return useQuery({ queryKey: keys.tiles, queryFn: getTiles, enabled })
}

/** Every peak the signed-in user reached, with the hikes that went over it. */
export function useSummits() {
  return useQuery({ queryKey: keys.summits, queryFn: listSummits })
}

/** The peaks one hike went over. */
export function useHikeSummits(id: string) {
  return useQuery({ queryKey: ['hikes', 'summits', id], queryFn: () => hikeSummits(id), staleTime: Infinity })
}

export function useLabels() {
  return useQuery({ queryKey: keys.labels, queryFn: listLabels })
}

export function useUploadHikes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: uploadHikes,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateHike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateHike,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeleteHike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteHike,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}
