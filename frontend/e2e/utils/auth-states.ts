import { Page } from '@playwright/test'
import { adminLogin, signup, login, logout, approveUser, rejectUser } from './index'

export type AuthState =
  | 'unauthenticated'
  | 'authenticated-user'
  | 'authenticated-admin'
  | 'pending-approval'
  | 'rejected'

export async function setupAuthState(page: Page, state: AuthState): Promise<{ email?: string; password?: string }> {
  await page.goto('/')

  switch (state) {
    case 'unauthenticated':
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      return {}

    case 'authenticated-user': {
      const userCreds = {
        name: `user_${Date.now()}`,
        email: `user_${Date.now()}@example.com`,
        password: 'Password1!',
      }
      await signup(page, userCreds.name, userCreds.email, userCreds.password)
      await adminLogin(page)
      await approveUser(page, userCreds.name)
      await logout(page)
      await login(page, userCreds.email, userCreds.password)
      return { email: userCreds.email, password: userCreds.password }
    }

    case 'authenticated-admin':
      await adminLogin(page)
      return {}

    case 'pending-approval': {
      const pendingCreds = {
        name: `pending_${Date.now()}`,
        email: `pending_${Date.now()}@example.com`,
        password: 'Password1!',
      }
      await signup(page, pendingCreds.name, pendingCreds.email, pendingCreds.password)
      return { email: pendingCreds.email, password: pendingCreds.password }
    }

    case 'rejected': {
      const rejectedCreds = {
        name: `rejected_${Date.now()}`,
        email: `rejected_${Date.now()}@example.com`,
        password: 'Password1!',
      }
      await signup(page, rejectedCreds.name, rejectedCreds.email, rejectedCreds.password)
      await adminLogin(page)
      await rejectUser(page, rejectedCreds.name)
      await logout(page)
      return { email: rejectedCreds.email, password: rejectedCreds.password }
    }
  }
}
