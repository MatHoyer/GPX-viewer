import { useTheme } from 'next-themes'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { themes } from './themes'

/** Compact picker for menus; Settings shows the themes as option cards. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      spacing={0}
      value={theme}
      onValueChange={(v) => v && setTheme(v)}
      aria-label="Theme"
      className={className}
    >
      {themes.map(({ value, label, icon: Icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            {/* The tooltip trigger overwrites data-state, so selection is styled from aria-checked. */}
            <ToggleGroupItem value={value} aria-label={label} className="aria-checked:bg-muted">
              <Icon />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}
