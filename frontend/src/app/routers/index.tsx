import { HomePage } from '@pages/home-page'
import { ForgotPasswordPage } from '@pages/password-recover'
import { SignUpPage } from '@pages/signup'
import { createBrowserRouter } from 'react-router-dom'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/register',
    element: <SignUpPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
])
