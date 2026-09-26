/** A calendar month, `month` is 0-based like `Date#getMonth`. */
export type YearMonth = { year: number; month: number }

export function currentMonth(now = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() }
}

/** Parses `YYYY-MM`, returning null for anything else. */
export function parseMonth(value: string | null): YearMonth | null {
  const match = value?.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const month = Number(match[2]) - 1
  return month >= 0 && month < 12 ? { year: Number(match[1]), month } : null
}

export function formatMonthParam({ year, month }: YearMonth): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** Local-time `YYYY-MM-DD` key, used to bucket hikes by day. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Days shown in the month grid: full Monday-to-Sunday weeks covering the month. */
export function monthGrid({ year, month }: YearMonth): Date[] {
  const first = new Date(year, month, 1)
  const leading = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Math.ceil((leading + daysInMonth) / 7) * 7
  return Array.from({ length: cells }, (_, i) => new Date(year, month, 1 - leading + i))
}
