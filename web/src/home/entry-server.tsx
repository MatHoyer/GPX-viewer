import { renderToStaticMarkup } from 'react-dom/server'

import { HomePage } from './HomePage'

export function render(): string {
  return renderToStaticMarkup(<HomePage />)
}
