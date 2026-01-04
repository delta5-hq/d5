import { Copyright } from '@shared/ui/copyright'
import { VersionDisplay } from '@shared/ui/version'
import { FormattedMessage } from 'react-intl'

export const FooterMetadata = () => (
  <div className="text-center text-foreground/40 text-sm">
    <FormattedMessage id="version" /> <VersionDisplay /> <Copyright />
  </div>
)
