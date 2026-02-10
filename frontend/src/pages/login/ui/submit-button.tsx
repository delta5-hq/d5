import { Button } from '@shared/ui/button'
import { FormattedMessage } from 'react-intl'

interface SubmitButtonProps {
  isSubmitting: boolean
}

export const SubmitButton = ({ isSubmitting }: SubmitButtonProps) => (
  <Button className="w-full" disabled={isSubmitting} type="submit" variant="accent">
    <FormattedMessage id="loginTitle" />
  </Button>
)
