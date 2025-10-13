import type { DialogProps } from '@shared/base-types'
import type React from 'react'
import type { ComponentType, ReactNode } from 'react'

export type OpenDialog = <P = DialogProps>(Component: ComponentType<P>, props?: Omit<P, 'open'>) => void

export interface DialogProviderProps {
  children: ReactNode
}

export type ShowDialogFn = <P>(Component: React.ComponentType<P>, props?: P) => void
