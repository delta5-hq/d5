import { cn } from '@shared/lib/utils'
import { SidebarMenuButton, SidebarMenuItem } from '@shared/ui/sidebar'
import { type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router-dom'
import { type SecondaryMenuItem } from '../../../config'
import styles from '../app-sidebar.module.scss'

interface ActionMenuItemProps {
  item: SecondaryMenuItem
  onAction: () => void
  isDisabled?: boolean
}

export const ActionMenuItem: FC<ActionMenuItemProps> = ({ item, onAction, isDisabled }) => {
  const { titleId, icon: Icon } = item

  return (
    <SidebarMenuItem key={titleId}>
      <SidebarMenuButton disabled={isDisabled} onClick={onAction}>
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="w-5 h-5" /> : null}
          <span className="text-sm">
            <FormattedMessage id={titleId} />
          </span>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

interface LinkMenuItemProps {
  item: SecondaryMenuItem
  isActive: boolean
  index: number
}

export const LinkMenuItem: FC<LinkMenuItemProps> = ({ item, isActive, index }) => {
  const { titleId, url, icon: Icon } = item

  return (
    <SidebarMenuItem className={cn(isActive && styles.menuLinkButton)} key={`${titleId}-${index}`}>
      <SidebarMenuButton asChild>
        <Link className="flex items-center gap-2" to={url}>
          {Icon ? <Icon className="w-5 h-5" /> : null}
          <span className={cn(isActive && styles.menuLinkText, 'text-sm')}>
            <FormattedMessage id={titleId} />
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
