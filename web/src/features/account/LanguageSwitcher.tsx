import { useTranslation } from 'react-i18next'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { isLanguage } from '@/i18n'
import { languageOptions } from '@/i18n/languages'

import { useSetLanguage } from './useLanguage'

/** Compact flag picker for menus and headers; Settings shows the languages as option cards. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const setLanguage = useSetLanguage()

  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      spacing={0}
      value={i18n.language}
      onValueChange={(v) => isLanguage(v) && setLanguage(v)}
      aria-label={t('settings.language')}
      className={className}
    >
      {languageOptions.map(({ value, label, flag: Flag }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            {/* The tooltip trigger overwrites data-state, so selection is styled from aria-checked. */}
            <ToggleGroupItem value={value} aria-label={label} lang={value} className="aria-checked:bg-muted">
              <Flag className="h-3 w-4.5 rounded-[2px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.2)]" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent lang={value}>{label}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}
