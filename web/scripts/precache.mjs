// Lists the build's files in dist/sw.js so the service worker caches the whole
// app on install. The list changes with every build, which updates the worker.
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const skip = new Set(['index.html', 'sw.js', 'og.png', '.gitkeep'])
const files = (await readdir(dist, { recursive: true, withFileTypes: true }))
  .filter((f) => f.isFile())
  .map((f) => `${f.parentPath.slice(dist.pathname.length)}/${f.name}`.replace(/^\//, ''))
  .filter((f) => !skip.has(f) && !f.startsWith('home.'))
  .map((f) => '/' + f)
  .sort()
const build = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
const sw = new URL('sw.js', dist)
const body = await readFile(sw, 'utf8')
await writeFile(sw, `self.__PRECACHE__ = ${JSON.stringify(files)}\nself.__BUILD__ = '${build}'\n${body}`)
