import { Button } from '@shared/ui/button'
import type React from 'react'
import { FormattedMessage } from 'react-intl'

export const WorkflowAddDashboard: React.FC = () => (
  <Button size="sm" variant="default" data-type="add-dashboard">
    <span className="mr-1">+</span>
    <FormattedMessage id="workflowAddDashboardLabel" />
  </Button>
)
