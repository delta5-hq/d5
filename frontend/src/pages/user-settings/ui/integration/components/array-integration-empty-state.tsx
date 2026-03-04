import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { Plus } from 'lucide-react'

import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'

interface Props {
  fieldName: string
  titleId: string
  onAdd: () => void
}

const ArrayIntegrationEmptyState: React.FC<Props> = ({ fieldName, titleId, onAdd }) => (
  <div className="w-full mb-6">
    <h3 className="text-lg font-semibold mb-4">
      <FormattedMessage id={titleId} />
    </h3>
    <Card className="border-dashed" glassEffect={false}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-3 mb-4">
          <Plus className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <FormattedMessage id="integrationSettings.none" />
        </p>
        <Button data-type={`add-${fieldName}`} onClick={onAdd} size="sm" variant="accent">
          <Plus className="h-4 w-4 mr-2" />
          <FormattedMessage id={`integration.${fieldName}.add`} />
        </Button>
      </CardContent>
    </Card>
  </div>
)

export default ArrayIntegrationEmptyState
