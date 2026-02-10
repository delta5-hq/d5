import { FormattedMessage } from 'react-intl'

interface AuthFormTitleProps {
  messageId: string
}

export const AuthFormTitle = ({ messageId }: AuthFormTitleProps) => (
  <h1 className="text-2xl font-semibold text-card-foreground text-center">
    <FormattedMessage id={messageId} />
  </h1>
)
