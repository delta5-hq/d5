import type { useAuth } from '../api'

export interface UserMeRes {
  id: string
  name: string
  mail: string
  roles: string[]
  createdAt: string // ISO
  updatedAt: string // ISO
}

export interface RequestRecoveryDto {
  usernameOrEmail: string
}

export interface ResetPasswordDto {
  token: string
  password: string
}

export type AuthStore = ReturnType<typeof useAuth>
