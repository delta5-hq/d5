import { useResponsive } from '@shared/composables'
import { Card, CardContent } from '@shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import React from 'react'
import IntegrationsPage from './integration/integrations-page'
import UserSettingsPage from './user-settings'

const ProfileSettings: React.FC = () => <UserSettingsPage />
const IntegrationsSettings: React.FC = () => <IntegrationsPage />

const MOBILE_BREAKPOINT = 768

const SettingsPage: React.FC = () => {
  const { isDesktop } = useResponsive({ breakpoint: MOBILE_BREAKPOINT })

  if (!isDesktop) {
    return (
      <Card className="w-full h-full">
        <CardContent className="w-full h-full overflow-y-auto">
          <Tabs className="w-full" defaultValue="profile">
            <TabsList className="mb-4">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
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
    <div className="flex flex-col gap-4 w-full h-full">
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
