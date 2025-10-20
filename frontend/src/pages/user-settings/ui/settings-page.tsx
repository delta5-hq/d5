import { useIsMobile } from '@shared/composables'
import { Card, CardContent } from '@shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import React from 'react'
import IntegrationsPage from './integration/integrations-page'
import UserSettingsPage from './user-settings'
import { FormattedMessage } from 'react-intl'

const ProfileSettings: React.FC = () => <UserSettingsPage />
const IntegrationsSettings: React.FC = () => <IntegrationsPage />

const SettingsPage: React.FC = () => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Card className="w-full h-full">
        <CardContent className="w-full h-full overflow-y-auto">
          <Tabs className="w-full" defaultValue="profile">
            <TabsList className="mb-4">
              <TabsTrigger value="profile">
                <FormattedMessage id="settingsPageProfile" />
              </TabsTrigger>
              <TabsTrigger value="integrations">
                <FormattedMessage id="settingsPageIntegrations" />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="profile">
              <ProfileSettings />
            </TabsContent>
            <TabsContent value="integrations">
              <IntegrationsSettings />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 w-full h-full grid-cols-1 xl:grid-cols-2">
      <Card className="w-full">
        <CardContent className="w-full overflow-y-auto">
          <ProfileSettings />
        </CardContent>
      </Card>
      <Card className="w-full">
        <CardContent className="w-full overflow-y-auto">
          <IntegrationsSettings />
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsPage
