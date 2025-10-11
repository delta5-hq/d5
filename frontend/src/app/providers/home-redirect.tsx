import { useAuthContext } from '@entities/auth'
import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export const HomeRedirect: React.FC = () => {
  const { isLoggedIn, isLoading } = useAuthContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (isLoggedIn) {
      navigate('/workflows', { replace: true })
    } else {
      navigate('/workflows/public', { replace: true })
    }
  }, [isLoggedIn, isLoading, navigate])

  return null
}
