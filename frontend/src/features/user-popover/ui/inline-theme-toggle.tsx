import { useTheme, type Theme } from '@shared/lib/theme-provider'
import { Button } from '@shared/ui/button'
import { AngularSeparator } from '@shared/ui/angular-separator'
import { Sun, Moon, Monitor, Palette } from 'lucide-react'
import { FormattedMessage } from 'react-intl'

export const InlineThemeToggle = () => {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (value: Theme) => () => {
    if (theme !== value) setTheme(value)
  }

  const isActive = (value: Theme) => theme === value

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <AngularSeparator icon={<Palette />} label={<FormattedMessage id="themeLabel" />} />

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="justify-start gap-2"
            onClick={handleThemeChange('light')}
            size="sm"
            variant={isActive('light') ? 'accent' : 'default'}
          >
            <Sun className="h-4 w-4" />
            <FormattedMessage id="themeLight" />
          </Button>

          <Button
            className="justify-start gap-2"
            onClick={handleThemeChange('dark')}
            size="sm"
            variant={isActive('dark') ? 'accent' : 'default'}
          >
            <Moon className="h-4 w-4" />
            <FormattedMessage id="themeDark" />
          </Button>
        </div>

        <Button
          className="w-full justify-start gap-2"
          onClick={handleThemeChange('system')}
          size="sm"
          variant={isActive('system') ? 'accent' : 'default'}
        >
          <Monitor className="h-4 w-4" />
          <FormattedMessage id="themeSystem" />
        </Button>
      </div>
    </div>
  )
}
