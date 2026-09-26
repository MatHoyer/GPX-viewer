import { Box, Layers, Map as MapIcon, Mountain, Satellite } from 'lucide-react'
import { forwardRef, useEffect, useRef, type ComponentProps } from 'react'

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

type Props = Omit<ComponentProps<typeof Map>, 'styles'>

/** Map with a switchable background (streets, topo, satellite) and optional 3D terrain. */
export const LayeredMap = forwardRef<MapRef, Props>(function LayeredMap({ children, ...props }, ref) {
  const basemap = useMapView((s) => s.basemap)
  const terrain = useMapView((s) => s.terrain)

  return (
    <Map ref={ref} styles={basemapStyles[basemap]} pitch={terrain ? TERRAIN_PITCH : 0} {...props}>
      <Terrain enabled={terrain} />
      <LayersControl />
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

const basemaps: { value: Basemap; label: string; icon: typeof MapIcon }[] = [
  { value: 'streets', label: 'Streets', icon: MapIcon },
  { value: 'topo', label: 'Topo', icon: Mountain },
  { value: 'satellite', label: 'Satellite', icon: Satellite },
]

function LayersControl() {
  const { basemap, terrain, setBasemap, setTerrain } = useMapView()

  return (
    <div className="absolute top-2 right-2 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Map layers"
            className="border-border bg-background hover:bg-accent dark:hover:bg-accent/40 focus-visible:ring-ring flex size-8 items-center justify-center rounded-md border shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Layers className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>Background</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={basemap} onValueChange={(v) => setBasemap(v as Basemap)}>
            {basemaps.map(({ value, label, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={terrain} onCheckedChange={(c) => setTerrain(c === true)}>
            <Box />
            3D terrain
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
