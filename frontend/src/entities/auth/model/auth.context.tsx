import React, { createContext, useContext } from 'react'
import type { AuthStore } from './types'
import { useAuth } from '../api'
import { useSessionBootstrap } from './use-session-bootstrap'

export const AuthContext = createContext<AuthStore | null>(null)

export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

export interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const isBootstrapped = useSessionBootstrap()
  const store = useAuth(isBootstrapped)

  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>
}
