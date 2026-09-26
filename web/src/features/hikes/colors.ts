// Distinct, saturated colors that read well on both light and dark basemaps.
const palette = ['#e4572e', '#2e86ab', '#8cb369', '#f4a259', '#9c6ade', '#17bebb', '#d1495b', '#3d5a80']

export function hikeColor(index: number): string {
  return palette[index % palette.length]
}
