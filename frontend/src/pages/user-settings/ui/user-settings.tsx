import React, { useEffect, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'

import { useAuthContext } from '@entities/auth'
import { Model, type IntegrationSettings } from '@shared/base-types'
import { useApiMutation, useApiQuery } from '@shared/composables'
import { queryKeys, USER_DEFAULT_MODEL } from '@shared/config'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Spinner } from '@shared/ui/spinner'
import { Card, CardContent } from '@shared/ui/card'
import { HelmetTitle } from '@shared/ui/helmet'

const UserSettingsPage: React.FC = () => {
  const { user } = useAuthContext()

  const {
    data: integration,
    isLoading: isSettingsLoading,
    refetch,
  } = useApiQuery<IntegrationSettings>({
    queryKey: queryKeys.integration,
    url: '/integration',
  })

  const { mutateAsync: changeUserModel, isPending: isSaving } = useApiMutation({
    url: '/integration/model',
    method: 'POST',
  })

  const [model, setModel] = useState(USER_DEFAULT_MODEL)

  useEffect(() => {
    if (integration?.model) {
      setModel(integration.model)
    }
  }, [integration])

  const handleSave = async () => {
    try {
      await changeUserModel({ model })
      await refetch()
      toast.success('Saved successfully')
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Request failed')
    }
  }

  return (
    <>
      <HelmetTitle titleId="pageTitle.settings" />
      <Card className="w-full h-full" glassEffect>
        <CardContent>
          <h2 className="text-lg font-semibold mb-4">
            <FormattedMessage id="profileSettings.editProfile" />
          </h2>

          {isSettingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4 max-w-xl">
              <div>
                <Label htmlFor="userId">
                  <FormattedMessage id="profileSettings.username" />
                </Label>
                <Input id="userId" readOnly value={user?.id ?? ''} />
              </div>

              <div>
                <Label htmlFor="userEmail">
                  <FormattedMessage id="profileSettings.emailAddress" />
                </Label>
                <Input id="userEmail" readOnly value={user?.mail ?? ''} />
              </div>

              <div>
                <Label htmlFor="model">
                  <FormattedMessage id="profileSettings.model" />
                </Label>

                <div className="mt-1">
                  <Select onValueChange={setModel} value={model}>
                    <SelectTrigger aria-label="Model select" className="w-full">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={USER_DEFAULT_MODEL}>Default</SelectItem>
                      {Object.values(Model).map(name => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button className="px-4 py-2" disabled={isSaving} onClick={handleSave}>
                  <FormattedMessage id="save" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

export default UserSettingsPage
