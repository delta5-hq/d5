import React, { createContext, useContext } from 'react'
import type { AuthStore } from './types'
import { useAuth } from '../api'

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
  const store = useAuth()

  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>
}
