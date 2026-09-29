import { ShieldCheck, SlidersHorizontal, UserCog, UserRound } from 'lucide-react'

/** The parts of Settings, each at its own URL; labels are under settings.sections. */
export const settingsSections = [
  { value: 'profile', path: '/settings', icon: UserRound },
  { value: 'security', path: '/settings/security', icon: ShieldCheck },
  { value: 'preferences', path: '/settings/preferences', icon: SlidersHorizontal },
  { value: 'account', path: '/settings/account', icon: UserCog },
] as const

export type SettingsSection = (typeof settingsSections)[number]['value']
