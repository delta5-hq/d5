import { Plus } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { FormattedMessage } from 'react-intl'

interface EmptyWorkflowViewProps {
  onCreateRoot: () => void
  isCreating?: boolean
}

export const EmptyWorkflowView = ({ onCreateRoot, isCreating }: EmptyWorkflowViewProps) => (
  <Card className="m-4">
    <CardContent className="py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <Plus className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-medium">
            <FormattedMessage id="workflowTree.empty.title" />
          </h3>
          <p className="text-sm text-muted-foreground">
            <FormattedMessage id="workflowTree.empty.description" />
          </p>
        </div>
        <Button disabled={isCreating} onClick={onCreateRoot} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          <FormattedMessage id="workflowTree.empty.createFirst" />
        </Button>
      </div>
    </CardContent>
  </Card>
)
