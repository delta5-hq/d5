import * as React from 'react'
import { FormattedMessage } from 'react-intl'

import type { DialogProps, IntegrationSettings } from '@shared/base-types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import IntegrationCategory from './integration-category'
import type { ShowDialogFn } from '@entities/dialog'

interface IntegrationDialogProps extends DialogProps {
  data: IntegrationSettings | undefined
  refresh: () => Promise<void>
  showDialog: ShowDialogFn
}

const IntegrationDialog: React.FC<IntegrationDialogProps> = ({ open, onClose, data, refresh, showDialog }) => (
  <Dialog onOpenChange={onClose} open={open}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          <FormattedMessage id="dialog.integration.title" />
        </DialogTitle>
      </DialogHeader>
      <IntegrationCategory data={data} refresh={refresh} showAll showDialog={showDialog} />
    </DialogContent>
  </Dialog>
)

export default IntegrationDialog
