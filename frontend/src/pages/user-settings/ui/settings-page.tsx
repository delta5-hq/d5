import { Card, CardContent } from '@shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import React from 'react'
import IntegrationsPage from './integration/integrations-page'
import UserSettingsPage from './user-settings'

const SettingsPage: React.FC = () => (
  <Card className="w-full h-full">
    <CardContent className="w-full h-full overflow-y-auto">
      <Tabs className="w-full" defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <UserSettingsPage />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsPage />
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
)

export default SettingsPage
