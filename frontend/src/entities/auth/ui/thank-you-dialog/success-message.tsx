import { FormattedMessage, useIntl } from 'react-intl'

interface SuccessMessageProps {
  titleId: string
  messageId: string
}

export const SuccessMessage = ({ titleId, messageId }: SuccessMessageProps) => {
  const { formatMessage } = useIntl()
  const message = formatMessage({ id: messageId })

  return (
    <div className="text-center space-y-4">
      <h2 className="text-2xl font-semibold text-card-foreground">
        <FormattedMessage id={titleId} />
      </h2>
      {/* eslint-disable-next-line react/no-danger */}
      <div className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: message }} />
    </div>
  )
}
