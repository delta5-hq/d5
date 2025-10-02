import { Sun, Moon, Laptop } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover'
import { Button } from '@shared/ui/button'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { Label } from '@shared/ui/label'
import { useTheme, type Theme } from '@shared/lib/theme-provider'
import { FormattedMessage } from 'react-intl'

export const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme()

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

      <PopoverContent className="p-5">
        <RadioGroup className="flex flex-col space-y-2" onValueChange={(value: Theme) => setTheme(value)} value={theme}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem id="light" value="light" />
            <Label className="flex items-center gap-2" htmlFor="light">
              <Sun className="h-4 w-4" /> <FormattedMessage id="themeLight" />
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem id="dark" value="dark" />
            <Label className="flex items-center gap-2" htmlFor="dark">
              <Moon className="h-4 w-4" /> <FormattedMessage id="themeDark" />
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem id="system" value="system" />
            <Label className="flex items-center gap-2" htmlFor="system">
              <Laptop className="h-4 w-4" /> <FormattedMessage id="themeSystem" />
            </Label>
          </div>
        </RadioGroup>
      </PopoverContent>
    </Popover>
  )
}
