import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { deleteHike, getTracks, listHikes, uploadHikes } from './api'

const keys = {
  all: ['hikes'] as const,
  list: ['hikes', 'list'] as const,
  tracks: ['hikes', 'tracks'] as const,
}

export function useHikes() {
  return useQuery({ queryKey: keys.list, queryFn: listHikes })
}

export function useTracks() {
  return useQuery({ queryKey: keys.tracks, queryFn: getTracks })
}

export function useUploadHikes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: uploadHikes,
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
