import { describe, expect, it } from 'vitest'

import { addMonths, dayKey, formatMonthParam, monthGrid, parseMonth } from './month'

describe('parseMonth', () => {
  it('parses YYYY-MM', () => {
    expect(parseMonth('2026-09')).toEqual({ year: 2026, month: 8 })
  })

  it('rejects invalid values', () => {
    expect(parseMonth(null)).toBeNull()
    expect(parseMonth('2026-13')).toBeNull()
    expect(parseMonth('2026-00')).toBeNull()
    expect(parseMonth('2026-9')).toBeNull()
  })

  it('round-trips with formatMonthParam', () => {
    expect(formatMonthParam(parseMonth('2026-01')!)).toBe('2026-01')
  })
})

describe('addMonths', () => {
  it('wraps across years', () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
  })
})

describe('monthGrid', () => {
  it('covers whole Monday-first weeks', () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday.
    const days = monthGrid({ year: 2026, month: 8 })
    expect(days).toHaveLength(35)
    expect(dayKey(days[0])).toBe('2026-08-31')
    expect(dayKey(days[1])).toBe('2026-09-01')
    expect(dayKey(days.at(-1)!)).toBe('2026-10-04')
    expect(days.every((d, i) => d.getDay() === (i + 1) % 7)).toBe(true)
  })

  it('has no leading days when the month starts on Monday', () => {
    // June 2026 starts on a Monday.
    expect(dayKey(monthGrid({ year: 2026, month: 5 })[0])).toBe('2026-06-01')
  })
})
