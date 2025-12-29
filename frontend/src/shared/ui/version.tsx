import { version } from './../../version'
import ClickToCopy from './click-to-copy'
import { FormattedMessage } from 'react-intl'
import { useSidebar } from './sidebar'

interface VersionDisplayProps {
  readonly isCollapsed?: boolean
}

const VersionDisplay = ({ isCollapsed = false }: VersionDisplayProps) => (
  <div className="flex justify-center items-center gap-2">
    <p className="text-sm group-data-[collapsible=icon]:hidden">
      <FormattedMessage id="sidebarBuild" />:
    </p>
    <ClickToCopy className={isCollapsed ? 'text-xs' : 'text-sm'} hideIcon={isCollapsed} text={version} />
  </div>
)

const PrimarySidebarVersion = () => {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  return <VersionDisplay isCollapsed={isCollapsed} />
}

const SecondarySidebarVersion = () => <VersionDisplay isCollapsed={false} />

const Version = PrimarySidebarVersion

export { Version, VersionDisplay, PrimarySidebarVersion, SecondarySidebarVersion }
