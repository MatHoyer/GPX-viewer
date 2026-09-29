import type * as GeoJSON from 'geojson'

import type { Person } from '@/features/account/displayName'
import type { HikeTiles } from '@/features/map/tiles'
import { api, ApiError } from '@/lib/api'

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
  /** A route not walked yet: shown on the map, left out of stats. */
  planned: boolean
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
  /** Friends the owner tagged. */
  participants?: Person[]
  /** Kudos and comments, on single-hike reads and the activity feed. */
  interactions?: { kudos: number; comments: number; kudoed: boolean }
}

export type BestEffort = { distanceM: number; durationS: number }

export type TrackProperties = { id: string; name: string }
export type Tracks = GeoJSON.FeatureCollection<GeoJSON.MultiLineString, TrackProperties>

export type UploadResult = {
  filename: string
  hike?: Hike
  error?: string
  /** Set with error, to show it in the user's language. */
  code?: string
  params?: Record<string, string | number>
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

export async function uploadHikes({ files, planned = false }: { files: File[]; planned?: boolean }) {
  const body = new FormData()
  for (const f of files) body.append('files', f)
  const res = await api<{ results: UploadResult[] }>(planned ? '/hikes?planned=true' : '/hikes', { method: 'POST', body })
  return res.results
}

export type HikeUpdate = { name?: string; notes?: string; labels?: string[] }

/** Hikes actually walked, for stats and records. */
export function doneHikes(hikes: Hike[]): Hike[] {
  return hikes.filter((h) => !h.planned)
}

export function updateHike({ id, ...patch }: { id: string } & HikeUpdate) {
  return api<Hike>(`/hikes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

/** Marks a planned hike as walked; a recorded GPX file, if given, replaces the planned route. */
export function markHikeDone({ id, file }: { id: string; file?: File }) {
  let body: FormData | undefined
  if (file) {
    body = new FormData()
    body.append('file', file)
  }
  return api<Hike>(`/hikes/${id}/done`, { method: 'POST', body })
}

/** The labels on the signed-in user's hikes, most used first. */
export function listLabels() {
  return api<string[]>('/labels')
}


/** Deletes those of ids you own; others are skipped. */
export function deleteHikes(ids: string[]) {
  return api<{ deleted: number }>('/hikes/delete', { method: 'POST', body: JSON.stringify({ ids }) })
}

/** Downloads a zip of the GPX files of those of ids you own. */
export async function exportHikes(ids: string[]) {
  const res = await fetch('/api/hikes/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string; params?: Record<string, string | number> }
    throw new ApiError(res.status, body.error ?? res.statusText, { code: body.code, params: body.params })
  }
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'hikes.zip'
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
