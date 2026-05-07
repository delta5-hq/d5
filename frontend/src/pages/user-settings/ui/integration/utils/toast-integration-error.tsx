import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'
import { classifyIntegrationError } from '@shared/lib/integration-api-error'

interface ToastIntegrationErrorOptions {
  model?: string
}

export function toastIntegrationError(error: unknown, options: ToastIntegrationErrorOptions = {}): void {
  const kind = classifyIntegrationError(error)

  switch (kind) {
    case 'auth':
      toast.error(<FormattedMessage id="dialog.integration.authenticationError" />)
      break
    case 'rate_limit':
      toast.error(<FormattedMessage id="dialog.integration.rateLimitExceeded" />)
      break
    case 'not_found':
      toast.error(<FormattedMessage id="dialog.integration.noAccess" values={{ model: options.model ?? '' }} />)
      break
    case 'server_error':
      toast.error(<FormattedMessage id="dialog.integration.serverError" />)
      break
    default:
      toast.error(<FormattedMessage id="dialog.integration.wrongRequest" />)
  }
}
