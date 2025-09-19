import type { LoginCredentials } from '@shared/base-types'
import type React from 'react'

export interface LoginDialogProps {
  children: React.ReactNode
  login: (data: LoginCredentials) => Promise<void>
}
