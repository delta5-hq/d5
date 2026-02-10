import { FormattedMessage } from 'react-intl'

interface SuccessMessageProps {
  titleId: string
  messageId: string
}

export const SuccessMessage = ({ titleId, messageId }: SuccessMessageProps) => (
  <div className="text-center space-y-3">
    <h2 className="text-2xl font-semibold text-card-foreground">
      <FormattedMessage id={titleId} />
    </h2>
    <p className="text-sm text-muted-foreground">
      <FormattedMessage id={messageId} />
    </p>
  </div>
)
