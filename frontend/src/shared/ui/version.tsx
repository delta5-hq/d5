import { version } from './../../version'
import ClickToCopy from './click-to-copy'
import { FormattedMessage } from 'react-intl'

const Version = () => (
  <div className="flex justify-center items-center gap-2 text-sm">
    {/* eslint-disable-next-line react/jsx-no-literals */}
    <p><FormattedMessage id="sidebarBuild" />:</p>
    <ClickToCopy text={version} />
  </div>
)

export { Version }
