import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '@pages/home-page'
import { ForgotPasswordPage, ResetPasswordPage } from '@pages/password-recover'
import { SignUpPage } from '@pages/signup'
import Providers from '@app/providers/providers'

export const router = createBrowserRouter([
  {
    element: <Providers />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/register', element: <SignUpPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password/:pwdResetToken', element: <ResetPasswordPage /> },
    ],
  },
])
