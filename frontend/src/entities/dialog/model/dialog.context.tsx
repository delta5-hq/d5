/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useCallback, useState, type ComponentType } from 'react'
import type { DialogProviderProps, OpenDialog } from './types'

export const DialogContext = createContext<OpenDialog | null>(null)

const stopPropagation = (event: React.KeyboardEvent) => {
  event.stopPropagation()
}

const DialogProvider = ({ children }: DialogProviderProps) => {
  const [Dialog, setDialog] = useState<ComponentType<any> | null>(null)
  const [dialogProps, setDialogProps] = useState<any>(undefined)

  const openDialog: OpenDialog = useCallback((Component, props) => {
    setDialog(() => Component)
    setDialogProps(props)
  }, [])

  const onClose = useCallback(() => {
    setDialog(null)
    setDialogProps(undefined)
  }, [])

  return (
    <>
      <DialogContext.Provider value={openDialog}>{children}</DialogContext.Provider>
      {Dialog ? <Dialog onClose={onClose} open {...dialogProps} onKeyDown={stopPropagation} /> : null}
    </>
  )
}

export { DialogProvider }
