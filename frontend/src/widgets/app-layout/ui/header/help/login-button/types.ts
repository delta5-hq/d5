import type { LoginCredentials } from '@shared/base-types'

export interface LoginButtonProps {
  login: (data: LoginCredentials) => Promise<void>
}
