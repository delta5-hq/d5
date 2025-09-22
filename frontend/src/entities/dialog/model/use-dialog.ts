import React, { useContext, useCallback } from 'react'
import { DialogContext } from './dialog.context'

export const useDialog = () => {
  const openDialog = useContext(DialogContext)

  if (!openDialog) {
    throw new Error('useDialog must be used within a DialogProvider')
  }

  const showDialog = useCallback(
    <P>(Component: React.ComponentType<P>, props?: P) => {
      openDialog(Component, props)
    },
    [openDialog],
  )

  return { showDialog }
}
