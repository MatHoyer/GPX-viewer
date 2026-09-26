import type * as GeoJSON from 'geojson'

import type { Person } from '@/features/account/displayName'
import type { HikeTiles } from '@/features/map/tiles'
import { api } from '@/lib/api'

export type Bounds = [minLon: number, minLat: number, maxLon: number, maxLat: number]

/** Mirror the API limits. */
export const MAX_NAME_LENGTH = 200
export const MAX_NOTES_LENGTH = 10000
export const MAX_LABEL_LENGTH = 32
export const MAX_LABELS = 20

export type Hike = {
  id: string
  /** The owner's id. */
  userId: string
  name: string
  distanceM: number
  elevationGainM: number
  startedAt: string | null
  durationS: number
  notes: string
  /** The owner's labels, lowercase and sorted. */
  labels: string[]
  elevationLossM: number
  /** Null when the track has no elevation. */
  minEleM: number | null
  maxEleM: number | null
  /** Null when the track has no timestamps. */
  movingS: number | null
  /** Fastest times over standard distances the hike covers, shortest first. */
  bestEfforts: BestEffort[]
  bounds: Bounds
  createdAt: string
  /** Omitted on hikes just returned by an upload. */
  owner?: Person
  /** Friends the owner tagged. Only set when fetching a single hike. */
  participants?: Person[]
}

export type BestEffort = { distanceM: number; durationS: number }

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

export function getTiles() {
  return api<HikeTiles>('/tiles')
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

export type HikeUpdate = { name?: string; notes?: string; labels?: string[] }

export function updateHike({ id, ...patch }: { id: string } & HikeUpdate) {
  return api<Hike>(`/hikes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

/** The labels on the signed-in user's hikes, most used first. */
export function listLabels() {
  return api<string[]>('/labels')
}

export function deleteHike(id: string) {
  return api<void>(`/hikes/${id}`, { method: 'DELETE' })
}
