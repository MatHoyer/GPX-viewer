import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { themes } from './themes'

/** Compact picker for menus; Settings shows the themes as option cards. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      spacing={0}
      value={theme}
      onValueChange={(v) => v && setTheme(v)}
      aria-label={t('nav.theme')}
      className={className}
    >
      {themes.map(({ value, icon: Icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            {/* The tooltip trigger overwrites data-state, so selection is styled from aria-checked. */}
            <ToggleGroupItem value={value} aria-label={t(`theme.${value}`)} className="aria-checked:bg-muted">
              <Icon />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{t(`theme.${value}`)}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}
