import { Button } from '@shared/ui/button'
import { FormattedMessage } from 'react-intl'

interface ActionButtonProps {
  onClick: () => void
}

export const ActionButton = ({ onClick }: ActionButtonProps) => (
  <div className="flex justify-center mt-6">
    <Button className="min-w-[120px]" onClick={onClick} type="button">
      <FormattedMessage id="OK" />
    </Button>
  </div>
)
