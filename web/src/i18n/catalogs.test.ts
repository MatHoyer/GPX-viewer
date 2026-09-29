import { describe, expect, it } from 'vitest'

import en from '@/locales/en.json'
import fr from '@/locales/fr.json'

type Catalog = { [key: string]: string | Catalog }

/** Every leaf as a dotted path, with its interpolated variables. */
function leaves(catalog: Catalog, prefix = ''): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      out.set(path, [...value.matchAll(/\{\{\s*(\w+)/g)].map((m) => m[1]).sort())
    } else {
      for (const [k, v] of leaves(value, path)) out.set(k, v)
    }
  }
  return out
}

// French plurals may add a _many form that English does not have.
const pluralKey = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '')

describe('translation catalogs', () => {
  const english = leaves(en)
  const french = leaves(fr)

  it('has every English key in French', () => {
    const missing = [...english.keys()].filter((k) => !french.has(k))
    expect(missing).toEqual([])
  })

  it('has no French key that English lacks', () => {
    const englishBases = new Set([...english.keys()].map(pluralKey))
    const extra = [...french.keys()].filter((k) => !english.has(k) && !englishBases.has(pluralKey(k)))
    expect(extra).toEqual([])
  })

  it('has the French "many" plural wherever there is an "other"', () => {
    // i18next falls back to English for 1 000 000 otherwise.
    const missing = [...french.keys()]
      .filter((k) => k.endsWith('_other'))
      .map((k) => k.replace(/_other$/, '_many'))
      .filter((k) => !french.has(k))
    expect(missing).toEqual([])
  })

  it('uses the same variables in both languages', () => {
    const variables = (k: string) => english.get(k) ?? english.get(k.replace(/_many$/, '_other'))
    const mismatched = [...french].filter(([k, vars]) => variables(k)?.join() !== vars.join())
    expect(mismatched.map(([k]) => k)).toEqual([])
  })
})
