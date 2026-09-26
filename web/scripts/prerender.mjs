// Renders the home page into dist/home.html after both Vite builds.
import { readFile, rm, writeFile } from 'node:fs/promises'

const { render } = await import('../dist-ssr/entry-server.js')
const file = new URL('../dist/home.html', import.meta.url)
const html = await readFile(file, 'utf8')
if (!html.includes('<!--home-->')) throw new Error('dist/home.html has no <!--home--> placeholder')
await writeFile(file, html.replace('<!--home-->', render()))
await rm(new URL('../dist-ssr', import.meta.url), { recursive: true })
