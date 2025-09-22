import { Button } from '@shared/ui/button'
import { X, Menu } from 'lucide-react'
import { FormattedMessage } from 'react-intl'

interface MenuButtonProps {
  opened?: boolean
  toggleButton?: () => void
}

const MenuButton = ({ opened, toggleButton }: MenuButtonProps) => (
  <Button onClick={toggleButton} variant="outline">
    <p>
      <FormattedMessage id="mobileMenuButtonTitle" />
    </p>
    {!opened ? <Menu /> : <X />}
  </Button>
)

export default MenuButton
