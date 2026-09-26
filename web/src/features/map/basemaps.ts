import type { RasterDEMSourceSpecification, StyleSpecification } from 'maplibre-gl'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type Basemap = 'streets' | 'topo' | 'satellite'

function rasterStyle(id: string, tiles: string, attribution: string, maxzoom: number): StyleSpecification {
  return {
    version: 8,
    sources: { [id]: { type: 'raster', tiles: [tiles], tileSize: 256, maxzoom, attribution } },
    layers: [{ id, type: 'raster', source: id }],
  }
}

const topo = rasterStyle(
  'opentopomap',
  'https://tile.opentopomap.org/{z}/{x}/{y}.png',
  'Map © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  17,
)

const satellite = rasterStyle(
  'esri-imagery',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  'Imagery © <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
  19,
)

/** `styles` prop for the map; undefined keeps the default light/dark street maps. */
export const basemapStyles: Record<Basemap, { light: StyleSpecification; dark: StyleSpecification } | undefined> = {
  streets: undefined,
  topo: { light: topo, dark: topo },
  satellite: { light: satellite, dark: satellite },
}

export const DEM_SOURCE_ID = 'terrain-dem'

/** Keyless global elevation tiles (AWS Terrain Tiles, Terrarium encoding). */
export const demSource: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 15,
  attribution: 'Elevation © <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen, AWS</a>',
}

type MapViewState = {
  basemap: Basemap
  terrain: boolean
  setBasemap: (basemap: Basemap) => void
  setTerrain: (terrain: boolean) => void
}

// localStorage can throw (private mode, blocked storage); fall back to in-memory.
const safeStorage = createJSONStorage(() => {
  try {
    localStorage.setItem('__probe', '1')
    localStorage.removeItem('__probe')
    return localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    }
  }
})

/** Background and 3D choice, shared by every map and remembered per browser. */
export const useMapView = create<MapViewState>()(
  persist(
    (set) => ({
      basemap: 'streets',
      terrain: false,
      setBasemap: (basemap) => set({ basemap }),
      setTerrain: (terrain) => set({ terrain }),
    }),
    { name: 'map-view', storage: safeStorage, partialize: ({ basemap, terrain }) => ({ basemap, terrain }) },
  ),
)
