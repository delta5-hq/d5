import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@shared/ui/sidebar'
import { type FC, type ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'

interface SidebarSectionProps {
  labelId: string
  children: ReactNode
}

export const SidebarSection: FC<SidebarSectionProps> = ({ labelId, children }) => (
  <SidebarGroup>
    <SidebarGroupLabel>
      <FormattedMessage id={labelId} />
    </SidebarGroupLabel>
    <SidebarGroupContent>{children}</SidebarGroupContent>
  </SidebarGroup>
)
