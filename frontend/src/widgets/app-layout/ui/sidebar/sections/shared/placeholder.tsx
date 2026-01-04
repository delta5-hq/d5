import { SidebarMenuButton, SidebarMenuItem } from '@shared/ui/sidebar'
import { type FC } from 'react'
import { FormattedMessage } from 'react-intl'

interface PlaceholderProps {
  messageId: string
}

export const Placeholder: FC<PlaceholderProps> = ({ messageId }) => (
  <SidebarMenuItem>
    <SidebarMenuButton disabled>
      <span className="text-sm text-muted-foreground">
        <FormattedMessage id={messageId} />
      </span>
    </SidebarMenuButton>
  </SidebarMenuItem>
)
