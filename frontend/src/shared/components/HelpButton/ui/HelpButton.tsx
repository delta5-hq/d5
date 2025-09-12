import { Button } from '@shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu'
import { HelpCircleIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { FormattedMessage } from 'react-intl'

const HelpButton = () => {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <DropdownMenu onOpenChange={() => setIsOpen(prev => !prev)} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <HelpCircleIcon />
          {isOpen ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>
          <FormattedMessage id="helpMenuLabel" />
        </DropdownMenuLabel>
        <DropdownMenuItem>
          <FormattedMessage id="helpMenuTutorials" />
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FormattedMessage id="helpMenuTerraformProvider" />
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FormattedMessage id="helpMenuChangelog" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <FormattedMessage id="helpMenuCreateSupportTicket" />
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FormattedMessage id="helpMenuGiveFeedback" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default HelpButton
