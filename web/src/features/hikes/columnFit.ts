/** Optional columns of the hikes table, most useful first, with their widths in pixels. */
export const optionalColumns = [
  { id: 'date', size: 132 },
  { id: 'distance', size: 104 },
  { id: 'elevation', size: 88 },
  { id: 'duration', size: 96 },
  { id: 'labels', size: 200 },
] as const

/** The select and actions columns, always shown. */
export const fixedWidth = 44 + 52

/** Narrowest the name column may get before optional columns give way. */
export const minNameWidth = 240

/**
 * Which optional columns fit in width: taken in order while the name column
 * keeps at least minNameWidth, stopping at the first that does not fit so a
 * less useful column never shows without a more useful one.
 */
export function fitColumns(width: number): Record<string, boolean> {
  let used = fixedWidth + minNameWidth
  let fits = true
  const visible: Record<string, boolean> = {}
  for (const { id, size } of optionalColumns) {
    fits = fits && used + size <= width
    if (fits) used += size
    visible[id] = fits
  }
  return visible
}
