import { create } from 'zustand'

import type { Person } from '@/features/account/displayName'
import { dayKey } from '@/features/calendar/month'

import type { Hike } from './api'

export type HikeFilters = {
  /** Matched against name, notes and labels, ignoring case. */
  query: string
  /** Inclusive local dates as YYYY-MM-DD, or '' for no bound. */
  from: string
  to: string
  minKm: number | null
  maxKm: number | null
  minGainM: number | null
  maxGainM: number | null
  /** Hikes must carry every selected label. */
  labels: string[]
  /** Hikes must include every selected person, as owner or participant. */
  people: string[]
  /** Walked hikes, planned routes, or both. */
  status: 'all' | 'done' | 'planned'
}

export const noFilters: HikeFilters = {
  query: '',
  from: '',
  to: '',
  minKm: null,
  maxKm: null,
  minGainM: null,
  maxGainM: null,
  labels: [],
  people: [],
  status: 'all',
}

/** Number of filters in use, for a badge. Each range counts once. */
export function activeFilterCount(f: HikeFilters): number {
  return [
    f.query.trim() !== '',
    f.from !== '' || f.to !== '',
    f.minKm !== null || f.maxKm !== null,
    f.minGainM !== null || f.maxGainM !== null,
    f.labels.length > 0,
    f.people.length > 0,
    f.status !== 'all',
  ].filter(Boolean).length
}

/** Everyone on a hike other than `userId`: its owner and the friends tagged on it. */
export function hikePeople(hike: Hike, userId: string | undefined): Person[] {
  const all = [...(hike.owner ? [hike.owner] : []), ...(hike.participants ?? [])]
  return all.filter((p) => p.id !== userId)
}

export function filterHikes(hikes: Hike[], f: HikeFilters, userId: string | undefined): Hike[] {
  if (activeFilterCount(f) === 0) return hikes
  const query = f.query.trim().toLowerCase()
  return hikes.filter((h) => {
    if ((f.status === 'done' && h.planned) || (f.status === 'planned' && !h.planned)) return false
    if (query && ![h.name, h.notes, ...h.labels].some((s) => s.toLowerCase().includes(query))) return false
    if (f.from || f.to) {
      if (!h.startedAt) return false
      const day = dayKey(new Date(h.startedAt))
      if ((f.from && day < f.from) || (f.to && day > f.to)) return false
    }
    const km = h.distanceM / 1000
    if ((f.minKm !== null && km < f.minKm) || (f.maxKm !== null && km > f.maxKm)) return false
    if ((f.minGainM !== null && h.elevationGainM < f.minGainM) || (f.maxGainM !== null && h.elevationGainM > f.maxGainM))
      return false
    if (!f.labels.every((l) => h.labels.includes(l))) return false
    if (f.people.length > 0) {
      const ids = new Set(hikePeople(h, userId).map((p) => p.id))
      if (!f.people.every((id) => ids.has(id))) return false
    }
    return true
  })
}

type FiltersState = {
  filters: HikeFilters
  setFilters: (patch: Partial<HikeFilters>) => void
  clearFilters: () => void
}

/** Filters on the signed-in user's hikes, shared by the map and the calendar. */
export const useHikeFilters = create<FiltersState>((set) => ({
  filters: noFilters,
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  clearFilters: () => set({ filters: noFilters }),
}))
