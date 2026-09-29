import { Monitor, Moon, Sun } from 'lucide-react'

// Labels and descriptions are translated under theme.<value>.
export const themes = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const
