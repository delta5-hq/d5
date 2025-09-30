import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '@pages/home-page'
import { ForgotPasswordPage, ResetPasswordPage } from '@pages/password-recover'
import { SignUpPage } from '@pages/signup'
import Providers from '@app/providers/providers'
import { AppLayout } from '@widgets/app-layout'
import { UserProfilePage, WaitlistPage } from '@pages/admin'
import { AdminUsersPage } from '@pages/admin'
import { SettingsPage } from '@pages/user-settings'

export const router = createBrowserRouter([
  {
    element: <Providers />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/register', element: <SignUpPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password/:pwdResetToken', element: <ResetPasswordPage /> },

      {
        path: '/settings',
        element: (
          <AppLayout>
            <SettingsPage />
          </AppLayout>
        ),
      },

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
          {
            path: 'users/:id',
            element: (
              <AppLayout>
                <UserProfilePage />
              </AppLayout>
            ),
          },
        ],
      },
    ],
  },
])
