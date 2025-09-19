import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '@pages/home-page'
import { ForgotPasswordPage, ResetPasswordPage } from '@pages/password-recover'
import { SignUpPage } from '@pages/signup'
import Providers from '@app/providers/providers'
import { AppLayout } from '@widgets/app-layout'
import { WaitlistPage } from '@pages/admin'
import { AdminUsersPage } from '@pages/admin'

export const router = createBrowserRouter([
  {
    element: <Providers />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/register', element: <SignUpPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password/:pwdResetToken', element: <ResetPasswordPage /> },

      {
        path: '/admin',
        children: [
          {
            path: 'waitlist',
            element: (
              <AppLayout>
                <WaitlistPage />
              </AppLayout>
            ),
          },
          {
            path: 'users',
            element: (
              <AppLayout>
                <AdminUsersPage />
              </AppLayout>
            ),
          },
        ],
      },
    ],
  },
])
