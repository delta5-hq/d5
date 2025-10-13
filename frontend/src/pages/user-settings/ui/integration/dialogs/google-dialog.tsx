import logger from '@shared/lib/logger'
import { gapi } from 'gapi-script'
import { X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'

import type { DialogProps, Google } from '@shared/base-types'
import { useApiMutation } from '@shared/composables'
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_DRIVE_DISCOVERY_DOCS, GOOGLE_DRIVE_SCOPE } from '@shared/config'
import { Button } from '@shared/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import type { HttpError } from '@shared/lib/error'

interface Props extends DialogProps {
  data: Google | undefined
  refresh: () => Promise<void>
}

const GoogleDialog: React.FC<Props> = ({ data, open, onClose, refresh }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [isGoogleDriveOn, setIsGoogleDriveOn] = useState(false)

  const { mutateAsync: save } = useApiMutation<Google, HttpError, Google>({
    url: '/integration/google/update',
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => {
      const message = err?.message
      if (message) toast.error(message)
      else toast.error(<FormattedMessage id="errorServer" />)
    },
  })

  useEffect(() => {
    gapi.load('client:auth2', async () => {
      await gapi.client.init({
        apiKey: GOOGLE_API_KEY,
        clientId: GOOGLE_CLIENT_ID,
        discoveryDocs: GOOGLE_DRIVE_DISCOVERY_DOCS,
        scope: GOOGLE_DRIVE_SCOPE,
        redirect_uri: location.origin,
      })
      const authInstance = gapi.auth2.getAuthInstance()
      if (!authInstance) return logger.error('Wrong Google Credentials')

      const isSignedIn = authInstance.isSignedIn.get()
      if (data?.drive && !isSignedIn) logger.error('Out of sync with the database')

      if (data?.drive) setIsGoogleDriveOn(data.drive)
      setIsLoading(false)
    })
  }, [data])

  const handleClick = async () => {
    setIsLoading(true)
    try {
      const authInstance = gapi.auth2.getAuthInstance()
      if (!authInstance) throw new Error('Google auth instance not found')

      if (!isGoogleDriveOn) {
        await authInstance.signIn()
        await save({ drive: true })
      } else {
        await authInstance.signOut()
        await save({ drive: false })
      }

      await refresh()
      onClose?.()
    } catch {
      setIsLoading(false)
      toast.error(<FormattedMessage id="integration.google.error" />)
    }
  }

  return (
    <Dialog onOpenChange={state => !state && onClose?.()} open={open}>
      <DialogContent className="max-w-md sm:w-full">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id="integration.google.title" />
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div className="flex justify-center py-4">
          <Button className="px-4 py-2" disabled={isLoading} onClick={handleClick}>
            {isLoading ? (
              <FormattedMessage id="integration.google.loading" />
            ) : !isGoogleDriveOn ? (
              <FormattedMessage id="integration.google.enable" />
            ) : (
              <FormattedMessage id="integration.google.disable" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default GoogleDialog
