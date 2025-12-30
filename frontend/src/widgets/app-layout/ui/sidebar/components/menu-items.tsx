import { cn } from '@shared/lib/utils'
import { SidebarMenuButton, SidebarMenuItem } from '@shared/ui/sidebar'
import { type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router-dom'
import { useAutoCloseOnMobile } from '../../../hooks/use-auto-close-on-mobile'
import { type SecondaryMenuItem } from '../../../config'
import styles from '../primary-sidebar.module.scss'
import { useDialog } from '@entities/dialog'
import { LoginDialog } from '@entities/auth'

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
  const { titleId, url, icon: Icon, action, dialog } = item
  const { handleMobileAutoClose } = useAutoCloseOnMobile()
  const { showDialog } = useDialog()

  const handleClick = () => {
    if (action === 'dialog' && dialog === 'login') {
      showDialog(LoginDialog)
      handleMobileAutoClose()
      return
    }
    handleMobileAutoClose()
  }

  if (action === 'dialog') {
    return (
      <SidebarMenuItem className={cn(isActive && styles.menuLinkButton)} key={`${titleId}-${index}`}>
        <SidebarMenuButton onClick={handleClick}>
          <div className="flex items-center gap-2">
            {Icon ? <Icon className="w-5 h-5" /> : null}
            <span className={cn(isActive && styles.menuLinkText, 'text-sm')}>
              <FormattedMessage id={titleId} />
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem className={cn(isActive && styles.menuLinkButton)} key={`${titleId}-${index}`}>
      <SidebarMenuButton asChild>
        <Link className="flex items-center gap-2" onClick={handleClick} to={url}>
          {Icon ? <Icon className="w-5 h-5" /> : null}
          <span className={cn(isActive && styles.menuLinkText, 'text-sm')}>
            <FormattedMessage id={titleId} />
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
