import { api } from '@/lib/api'

export type Peak = { id: number; name: string; eleM: number | null; lon: number; lat: number }
export type SummitVisit = { hikeId: string; startedAt: string | null }
export type Summit = { peak: Peak; visits: SummitVisit[] }

export function listSummits() {
  return api<Summit[]>('/summits')
}

export function hikeSummits(id: string) {
  return api<Peak[]>(`/hikes/${id}/summits`)
}

/** Summits reached on the given hikes only, keeping each summit's visits among them. */
export function summitsOn(summits: Summit[], hikeIds: Set<string>): Summit[] {
  return summits.flatMap((s) => {
    const visits = s.visits.filter((v) => hikeIds.has(v.hikeId))
    return visits.length > 0 ? [{ ...s, visits }] : []
  })
}

/** The earliest dated visit, else any. Visits come newest first. */
export function firstVisit(s: Summit): SummitVisit {
  return [...s.visits].reverse().find((v) => v.startedAt) ?? s.visits[s.visits.length - 1]
}
