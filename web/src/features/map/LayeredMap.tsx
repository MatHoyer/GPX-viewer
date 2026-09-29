import { Box, Flame, Grid3x3, Layers, Map as MapIcon, Mountain, Satellite } from 'lucide-react'
import { forwardRef, useEffect, useRef, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Map, useMap, type MapRef } from '@/components/ui/map'

import { basemapStyles, DEM_SOURCE_ID, demSource, useMapView, type Basemap } from './basemaps'

const TERRAIN_PITCH = 60

type Props = Omit<ComponentProps<typeof Map>, 'styles'> & {
  /** Offer the heatmap toggle; the caller draws the heatmap itself. */
  heatmapToggle?: boolean
  /** Offer the explored tiles toggle; the caller draws the tiles itself. */
  tilesToggle?: boolean
}

/** Map with a switchable background (streets, topo, satellite) and optional 3D terrain. */
export const LayeredMap = forwardRef<MapRef, Props>(function LayeredMap({ children, heatmapToggle = false, tilesToggle = false, ...props }, ref) {
  const basemap = useMapView((s) => s.basemap)
  const terrain = useMapView((s) => s.terrain)

  return (
    <Map ref={ref} styles={basemapStyles[basemap]} pitch={terrain ? TERRAIN_PITCH : 0} {...props}>
      <Terrain enabled={terrain} />
      <LayersControl heatmapToggle={heatmapToggle} tilesToggle={tilesToggle} />
      {children}
    </Map>
  )
})

/** Keeps the elevation source and terrain on the current style, re-adding them after each style swap. */
function Terrain({ enabled }: { enabled: boolean }) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return
    if (enabled) {
      if (!map.getSource(DEM_SOURCE_ID)) map.addSource(DEM_SOURCE_ID, demSource)
      map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: 1.5 })
    } else if (map.getTerrain()) {
      map.setTerrain(null)
    }
  }, [map, isLoaded, enabled])

  // Tilt when the toggle changes; the initial pitch comes from the map props.
  const previous = useRef(enabled)
  useEffect(() => {
    if (!map || previous.current === enabled) return
    previous.current = enabled
    map.easeTo({ pitch: enabled ? TERRAIN_PITCH : 0, duration: 800 })
  }, [map, enabled])

  return null
}

// Labels are translated under map.<value>.
const basemaps: { value: Basemap; icon: typeof MapIcon }[] = [
  { value: 'streets', icon: MapIcon },
  { value: 'topo', icon: Mountain },
  { value: 'satellite', icon: Satellite },
]

function LayersControl({ heatmapToggle, tilesToggle }: { heatmapToggle: boolean; tilesToggle: boolean }) {
  const { t } = useTranslation()
  const { basemap, terrain, heatmap, tiles, setBasemap, setTerrain, setHeatmap, setTiles } = useMapView()

  return (
    <div className="absolute top-2 right-2 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('map.layers')}
            className="border-border bg-background hover:bg-accent dark:hover:bg-accent/40 focus-visible:ring-ring flex size-8 items-center justify-center rounded-md border shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Layers className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>{t('map.background')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={basemap} onValueChange={(v) => setBasemap(v as Basemap)}>
            {basemaps.map(({ value, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon />
                {t(`map.${value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={terrain} onCheckedChange={(c) => setTerrain(c === true)}>
            <Box />
            {t('map.terrain')}
          </DropdownMenuCheckboxItem>
          {heatmapToggle && (
            <DropdownMenuCheckboxItem checked={heatmap} onCheckedChange={(c) => setHeatmap(c === true)}>
              <Flame />
              {t('map.heatmap')}
            </DropdownMenuCheckboxItem>
          )}
          {tilesToggle && (
            <DropdownMenuCheckboxItem checked={tiles} onCheckedChange={(c) => setTiles(c === true)}>
              <Grid3x3 />
              {t('stats.exploredTiles')}
            </DropdownMenuCheckboxItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
