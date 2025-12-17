import { version } from './../../version'
import ClickToCopy from './click-to-copy'
import { FormattedMessage } from 'react-intl'
import { useSidebar } from './sidebar'

interface VersionBaseProps {
  readonly isCollapsed?: boolean
}

const VersionBase = ({ isCollapsed = false }: VersionBaseProps) => (
  <div className="flex justify-center items-center gap-2">
    <p className="text-sm group-data-[collapsible=icon]:hidden">
      <FormattedMessage id="sidebarBuild" />:
    </p>
    <ClickToCopy className={isCollapsed ? 'text-xs' : 'text-sm'} hideIcon={isCollapsed} text={version} />
  </div>
)

const Version = () => {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  return <VersionBase isCollapsed={isCollapsed} />
}

export { Version, VersionBase }
