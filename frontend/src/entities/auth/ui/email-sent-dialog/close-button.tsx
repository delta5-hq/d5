import { Button } from '@shared/ui/button'
import { FormattedMessage } from 'react-intl'

interface CloseButtonProps {
  onClick: () => void
}

export const CloseButton = ({ onClick }: CloseButtonProps) => (
  <div className="flex justify-center mt-6">
    <Button className="min-w-[120px]" onClick={onClick} type="button">
      <FormattedMessage id="OK" />
    </Button>
  </div>
)
