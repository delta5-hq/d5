import { useAuthContext } from '@entities/auth'
import { StatusPlaceholder } from '@shared/ui/status-placeholder'
import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export const ProtectedRoute: React.FC = () => {
  const { isLoggedIn, isLoading } = useAuthContext()
  const location = useLocation()

  if (isLoading) {
    return <StatusPlaceholder loading />
  }

  if (!isLoggedIn) {
    return <Navigate replace state={{ from: location }} to="/" />
  }

  return <Outlet />
}

export const PublicRoute: React.FC = () => <Outlet />
