import { renderToStaticMarkup } from 'react-dom/server'

import { languages, type Language } from '@/i18n'

import { HomePage } from './HomePage'

export { languages }

export function render(lang: Language): string {
  return renderToStaticMarkup(<HomePage lang={lang} />)
}
