import type { ComponentType, SVGProps } from 'react'

import { FlagFR, FlagGB } from './flags'
import type { Language } from '.'

/** Each language is named in itself, so it can be found whatever is shown. */
export const languageOptions: { value: Language; label: string; flag: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { value: 'en', label: 'English', flag: FlagGB },
  { value: 'fr', label: 'Français', flag: FlagFR },
]
