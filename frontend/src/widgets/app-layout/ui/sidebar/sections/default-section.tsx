import { SidebarMenu } from '@shared/ui/sidebar'
import { type FC } from 'react'
import { useLocation } from 'react-router-dom'
import { getSectionGroupLabel, isMenuItemActive, type SecondaryMenuItem } from '../../../config'
import { useWorkflowActions } from '../../../hooks/use-workflow-actions'
import { ActionMenuItem, LinkMenuItem } from '../components/menu-items'
import { SidebarSection } from '../components/sidebar-section'

interface DefaultSectionProps {
  menuItems: ReadonlyArray<SecondaryMenuItem>
  activeSection: string
}

export const DefaultSection: FC<DefaultSectionProps> = ({ menuItems, activeSection }) => {
  const location = useLocation()
  const { createWorkflow, isCreatingWorkflow } = useWorkflowActions()

  const renderMenuItem = (item: SecondaryMenuItem, index: number) => {
    if (item.action === 'create') {
      return <ActionMenuItem isDisabled={isCreatingWorkflow} item={item} key={item.titleId} onAction={createWorkflow} />
    }

    const isActive = isMenuItemActive(item.url, location.pathname)
    return <LinkMenuItem index={index} isActive={isActive} item={item} key={`${item.titleId}-${index}`} />
  }

  return (
    <SidebarSection labelId={getSectionGroupLabel(activeSection)}>
      <SidebarMenu>{menuItems.map((item, index) => renderMenuItem(item, index))}</SidebarMenu>
    </SidebarSection>
  )
}
