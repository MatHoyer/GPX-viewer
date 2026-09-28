import { Monitor, Moon, Sun } from 'lucide-react'

export const themes = [
  { value: 'light', label: 'Light', description: 'Always light.', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Always dark.', icon: Moon },
  { value: 'system', label: 'System', description: 'Follows your device setting.', icon: Monitor },
]
