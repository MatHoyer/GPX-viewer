/** Walking speed assumed for planned routes until we learn it from past hikes. */
export const ESTIMATED_SPEED_KMH = 3.5

/** Explains an estimated duration, for tooltips and hints. */
export const ESTIMATE_NOTE = `Estimated at ${ESTIMATED_SPEED_KMH} km/h`

/** Time to walk a planned route at ESTIMATED_SPEED_KMH. */
export function estimatedDurationS(distanceM: number): number {
  return (distanceM / 1000 / ESTIMATED_SPEED_KMH) * 3600
}
