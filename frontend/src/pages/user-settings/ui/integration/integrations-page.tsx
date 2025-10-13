import { useDialog } from '@entities/dialog'
import { useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'
import { Button } from '@shared/ui/button'
import { FormattedMessage } from 'react-intl'
import IntegrationCategory from './integration-category'
import IntegrationDialog from './integration-dialog'
import type { IntegrationSettings } from '@shared/base-types'

const IntegrationPage = () => {
  const { showDialog } = useDialog()

  const { data, refetch } = useApiQuery<IntegrationSettings>({
    queryKey: queryKeys.integration,
    url: '/integration',
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
            })
          }
          variant="accent"
        >
          <FormattedMessage id="integrationSettings.addApps" />
        </Button>
      </div>

      <div className="flex justify-center">
        {data ? <IntegrationCategory data={data} refresh={redrawPage} showDialog={showDialog} /> : null}
      </div>
    </div>
  )
}

export default IntegrationPage
