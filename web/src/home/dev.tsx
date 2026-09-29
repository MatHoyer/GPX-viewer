import { createRoot } from 'react-dom/client'

import { currentLanguage } from '@/i18n'

import { HomePage } from './HomePage'

createRoot(document.getElementById('home')!).render(<HomePage lang={currentLanguage()} />)
