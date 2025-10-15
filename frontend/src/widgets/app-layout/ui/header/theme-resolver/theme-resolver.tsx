import { Sun, Moon, Laptop } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import { useTheme, type Theme } from '@shared/lib/theme-provider'
import { FormattedMessage } from 'react-intl'

export const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme()

  const handleClick = (value: Theme) => () => {
    if (theme !== value) setTheme(value)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="relative" size="icon" variant="ghost">
          {theme === 'dark' ? (
            <Moon className="h-[1.2rem] w-[1.2rem]" />
          ) : theme === 'light' ? (
            <Sun className="h-[1.2rem] w-[1.2rem]" />
          ) : (
            <Laptop className="h-[1.2rem] w-[1.2rem]" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-4 w-[220px] flex flex-col items-center space-y-1">
        <Button
          className="w-full text-sm"
          onClick={handleClick('system')}
          variant={theme === 'system' ? 'accent' : 'default'}
        >
          <FormattedMessage id="themeSystem" />
        </Button>

        <div className="flex w-full justify-between space-x-2">
          <Button
            className="flex-1 flex items-center justify-center gap-2"
            onClick={handleClick('light')}
            variant={theme === 'light' ? 'accent' : 'default'}
          >
            <Sun className="h-4 w-4" />
            <FormattedMessage id="themeLight" />
          </Button>

          <Button
            className="flex-1 flex items-center justify-center gap-2"
            onClick={handleClick('dark')}
            variant={theme === 'dark' ? 'accent' : 'default'}
          >
            <Moon className="h-4 w-4" />
            <FormattedMessage id="themeDark" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
