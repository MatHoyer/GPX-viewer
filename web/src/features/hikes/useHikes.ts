import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { deleteHike, getTiles, getTracks, listHikes, listLabels, updateHike, uploadHikes } from './api'

const keys = {
  all: ['hikes'] as const,
  list: ['hikes', 'list'] as const,
  tracks: ['hikes', 'tracks'] as const,
  labels: ['hikes', 'labels'] as const,
  tiles: ['hikes', 'tiles'] as const,
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
