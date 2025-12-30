import { useAuthContext } from '@entities/auth'
import { LandingPage } from '@pages/landing'
import { StatusPlaceholder } from '@shared/ui/status-placeholder'
import React from 'react'
import { Navigate } from 'react-router-dom'

export const HomeRedirect: React.FC = () => {
  const { isLoggedIn, isLoading } = useAuthContext()

  if (isLoading) {
    return <StatusPlaceholder loading />
  }

  if (isLoggedIn) {
    return <Navigate replace to="/workflows" />
  }

  return <LandingPage />
}
