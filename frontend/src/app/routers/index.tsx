import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ForgotPasswordPage, ResetPasswordPage } from '@pages/password-recover'
import { SignUpPage } from '@pages/signup'
import Providers from '@app/providers/providers'
import { AppLayout } from '@widgets/app-layout'
import { UserProfilePage, WaitlistPage, AdminUsersPage } from '@pages/admin'
import { SettingsPage } from '@pages/user-settings'
import { WorkflowPage, WorkflowsListPage } from '@pages/workflow'
import { ProtectedRoute, PublicRoute } from '@app/providers/guards'
import { HomeRedirect } from '@app/providers/home-redirect'

export const router = createBrowserRouter([
  {
    element: <Providers />,
    children: [
      {
        element: <PublicRoute />,
        children: [
          { path: '/', element: <HomeRedirect /> },
          { path: '/register', element: <SignUpPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password/:pwdResetToken', element: <ResetPasswordPage /> },
          {
            path: '/workflows/public',
            element: <WorkflowsListPage />,
          },
        ],
      },

      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/settings',
            element: (
              <AppLayout>
                <SettingsPage />
              </AppLayout>
            ),
          },
          {
            path: '/workflow/:workflowId',
            element: (
              <AppLayout>
                <WorkflowPage />
              </AppLayout>
            ),
          },
          {
            path: '/workflows',
            element: <WorkflowsListPage />,
          },
          {
            path: '/admin',
            children: [
              {
                index: true,
                element: <Navigate replace to="/admin/users" />,
              },
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
    ],
  },
])
