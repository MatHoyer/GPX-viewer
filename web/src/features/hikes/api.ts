import type * as GeoJSON from 'geojson'

import type { Person } from '@/features/account/displayName'
import { api } from '@/lib/api'

export type Bounds = [minLon: number, minLat: number, maxLon: number, maxLat: number]

/** Mirrors the API limit on hike names. */
export const MAX_NAME_LENGTH = 200

export type Hike = {
  id: string
  /** The owner's id. */
  userId: string
  name: string
  distanceM: number
  elevationGainM: number
  startedAt: string | null
  durationS: number
  bounds: Bounds
  createdAt: string
  /** Omitted on hikes just returned by an upload. */
  owner?: Person
  /** Friends the owner tagged. Only set when fetching a single hike. */
  participants?: Person[]
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

export function renameHike({ id, name }: { id: string; name: string }) {
  return api<Hike>(`/hikes/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export function deleteHike(id: string) {
  return api<void>(`/hikes/${id}`, { method: 'DELETE' })
}
