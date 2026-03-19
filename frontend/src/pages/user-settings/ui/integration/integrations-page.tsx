import { useDialog } from '@entities/dialog'
import { useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'
import { Button } from '@shared/ui/button'
import { FormattedMessage } from 'react-intl'
import { useState } from 'react'
import IntegrationCategory from './integration-category'
import IntegrationDialog from './integration-dialog'
import type { IntegrationSettings } from '@shared/base-types'
import { WorkflowScopeSelector } from './components/workflow-scope-selector'

const IntegrationPage = () => {
  const { showDialog } = useDialog()
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)

  const workflowParam = selectedWorkflowId ? `?workflowId=${selectedWorkflowId}` : ''

  const { data, refetch } = useApiQuery<IntegrationSettings>({
    queryKey: [...queryKeys.integration, selectedWorkflowId],
    url: `/integration${workflowParam}`,
  })

  const redrawPage = async () => {
    await refetch()
  }

  return (
    <div className="space-y-4 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          <FormattedMessage id="integrationSettings.appsIntegrations" />
        </h2>

        <Button
          data-type="add-integration"
          onClick={() =>
            showDialog(IntegrationDialog, {
              data,
              showDialog,
              refresh: redrawPage,
              workflowId: selectedWorkflowId,
            })
          }
          variant="accent"
        >
          <FormattedMessage id="integrationSettings.addApps" />
        </Button>
      </div>

      <div className="mb-4">
        <WorkflowScopeSelector onChange={setSelectedWorkflowId} value={selectedWorkflowId} />
      </div>

      <div className="flex justify-center">
        {data ? (
          <IntegrationCategory
            data={data}
            refresh={redrawPage}
            showDialog={showDialog}
            workflowId={selectedWorkflowId}
          />
        ) : null}
      </div>
    </div>
  )
}

export default IntegrationPage
