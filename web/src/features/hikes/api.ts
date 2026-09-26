import type * as GeoJSON from 'geojson'

import { api } from '@/lib/api'

export type Bounds = [minLon: number, minLat: number, maxLon: number, maxLat: number]

export type Hike = {
  id: string
  name: string
  distanceM: number
  elevationGainM: number
  startedAt: string | null
  durationS: number
  bounds: Bounds
  createdAt: string
}

export type TrackProperties = { id: string; name: string }
export type Tracks = GeoJSON.FeatureCollection<GeoJSON.MultiLineString, TrackProperties>

export type UploadResult = {
  filename: string
  hike?: Hike
  error?: string
}

export function listHikes() {
  return api<Hike[]>('/hikes')
}

export function getTracks() {
  return api<Tracks>('/hikes/tracks')
}

export async function uploadHikes(files: File[]) {
  const body = new FormData()
  for (const f of files) body.append('files', f)
  const res = await api<{ results: UploadResult[] }>('/hikes', { method: 'POST', body })
  return res.results
}

export function deleteHike(id: string) {
  return api<void>(`/hikes/${id}`, { method: 'DELETE' })
}
