import { ResponsivePopover } from '@shared/ui/responsive-popover'
import { InlineThemeToggle } from '@features/user-popover/ui/inline-theme-toggle'
import { useThemeIcon } from '@shared/lib/use-theme-icon'
import { Sun, Moon } from 'lucide-react'

interface ThemePopoverProps {
  breakpoint?: number
}

export const ThemePopover = ({ breakpoint = 768 }: ThemePopoverProps) => {
  const { isDark } = useThemeIcon()

  return (
    <ResponsivePopover
      breakpoint={breakpoint}
      dataType="theme-settings"
      trigger={
        <button
          className="flex items-center justify-center w-10 h-10 p-0 border-none bg-transparent rounded-md text-[hsl(var(--sidebar-foreground))] cursor-pointer transition-all duration-200 hover:bg-[hsl(var(--sidebar-accent))] hover:scale-110"
          type="button"
        >
          {isDark ? <Moon className="w-6 h-6" strokeWidth={2.5} /> : <Sun className="w-6 h-6" strokeWidth={2.5} />}
        </button>
      }
    >
      {() => <InlineThemeToggle />}
    </ResponsivePopover>
  )
}
