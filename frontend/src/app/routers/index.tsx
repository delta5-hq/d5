import { HomePage } from '@pages/home-page'
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
])
