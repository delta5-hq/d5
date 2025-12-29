import { useDualSidebar } from '@shared/context'
import { Button } from '@shared/ui/button'
import { Menu } from 'lucide-react'
import { FormattedMessage } from 'react-intl'

interface SecondaryMenuToggleProps {
  className?: string
}

export const SecondaryMenuToggle = ({ className }: SecondaryMenuToggleProps) => {
  const { toggleSecondary } = useDualSidebar()

  return (
    <Button className={className} onClick={toggleSecondary} size="icon" variant="ghost">
      <Menu />
      <span className="sr-only">
        <FormattedMessage id="toggleSecondaryMenu" />
      </span>
    </Button>
  )
}
