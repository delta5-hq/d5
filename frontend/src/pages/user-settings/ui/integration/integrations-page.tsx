import { useDialog } from '@entities/dialog'
import { useApiQuery } from '@shared/composables'
import { queryKeys } from '@shared/config'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { FormattedMessage } from 'react-intl'
import IntegrationCategory from './integration-category'
import IntegrationDialog from './integration-dialog'
import type { IntegrationSettings } from '@shared/base-types'
import { HelmetTitle } from '@shared/ui/helmet'

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
    <>
      <HelmetTitle titleId="pageTitle.settings" />
      <Card className="rounded-none h-full w-full overflow-y-auto">
        <CardContent className="space-y-4">
          <h2 className="text-xl font-semibold">
            <FormattedMessage id="integrationSettings.appsIntegrations" />
          </h2>

          <div>
            <Button
              onClick={() =>
                showDialog(IntegrationDialog, {
                  data,
                  showDialog,
                  refresh: redrawPage,
                })
              }
              variant="link"
            >
              <FormattedMessage id="integrationSettings.addApps" />
            </Button>
          </div>

          <div className="flex justify-center">
            {data ? <IntegrationCategory data={data} refresh={redrawPage} showDialog={showDialog} /> : null}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export default IntegrationPage
