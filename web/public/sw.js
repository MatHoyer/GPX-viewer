// Service worker: keeps the app, the last API answers and the map tiles you
// have seen available offline, so a hike can be recorded without signal.
// scripts/precache.mjs fills in the build's files, which also versions this file.
const PRECACHE = self.__PRECACHE__ || []
const SHELL = 'shell-' + (self.__BUILD__ || 'dev')
const API = 'api'
const TILES = 'tiles'
const MAX_TILES = 4000
const TILE_HOSTS = [
  'basemaps.cartocdn.com',
  'tiles.basemaps.cartocdn.com',
  'tile.opentopomap.org',
  'server.arcgisonline.com',
  's3.amazonaws.com',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['/index.html', ...PRECACHE]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (url.origin !== self.location.origin) {
    if (TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
      event.respondWith(cacheFirst(TILES, req, () => ++tilesPut % 100 === 0 && trimTiles()))
    }
    return
  }
  if (req.mode === 'navigate') {
    // The server picks the landing page or the app; offline it is always the app.
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')))
    return
  }
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(API, req))
    return
  }
  event.respondWith(cacheFirst(SHELL, req))
})

let tilesPut = 0

async function cacheFirst(name, req, afterPut) {
  const hit = await caches.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) {
    const cache = await caches.open(name)
    await cache.put(req, res.clone())
    afterPut?.()
  }
  return res
}

async function networkFirst(name, req) {
  try {
    const res = await fetch(req)
    if (res.ok) (await caches.open(name)).put(req, res.clone())
    return res
  } catch (err) {
    const hit = await caches.match(req)
    if (hit) return hit
    throw err
  }
}

// Cache keys come back in insertion order, so the oldest tiles go first.
async function trimTiles() {
  const cache = await caches.open(TILES)
  const keys = await cache.keys()
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await cache.delete(key)
}

