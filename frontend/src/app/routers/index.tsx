import { HomePage } from '@pages/home-page'
import { ForgotPasswordPage, ResetPasswordPage } from '@pages/password-recover'
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
  {
    path: '/reset-password/:pwdResetToken',
    element: <ResetPasswordPage />,
  },
])
