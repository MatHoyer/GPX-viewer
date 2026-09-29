// Renders the home page after both Vite builds, once per language:
// dist/home.html in English and dist/home.<lang>.html for the others.
import { readFile, rm, writeFile } from 'node:fs/promises'

const { render, languages } = await import('../dist-ssr/entry-server.js')
const file = new URL('../dist/home.html', import.meta.url)
const template = await readFile(file, 'utf8')
if (!template.includes('<!--home-->')) throw new Error('dist/home.html has no <!--home--> placeholder')

const catalog = async (lang) => JSON.parse(await readFile(new URL(`../src/locales/${lang}.json`, import.meta.url), 'utf8'))
const english = (await catalog('en')).home.meta

for (const lang of languages) {
  const meta = (await catalog(lang)).home.meta
  let html = template.replace('<html lang="en">', `<html lang="${lang}">`)
  // The template's head is written in English; swap in this language's text.
  for (const key of Object.keys(english)) {
    if (!html.includes(english[key])) throw new Error(`home.html does not contain home.meta.${key} from en.json`)
    html = html.replaceAll(english[key], meta[key])
  }
  html = html.replace('<!--home-->', render(lang))
  await writeFile(new URL(lang === 'en' ? '../dist/home.html' : `../dist/home.${lang}.html`, import.meta.url), html)
}
await rm(new URL('../dist-ssr', import.meta.url), { recursive: true })
