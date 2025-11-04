import { Button } from '@shared/ui/button'
import type React from 'react'
import { FormattedMessage } from 'react-intl'

export const WorkflowAddDashboard: React.FC = () => (
  <Button data-type="add-dashboard" size="sm" variant="default">
    <span className="mr-1">+</span>
    <FormattedMessage id="workflowAddDashboardLabel" />
  </Button>
)
