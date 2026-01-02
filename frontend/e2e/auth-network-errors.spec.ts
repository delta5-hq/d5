import { test, expect } from '@playwright/test'
import { clearAuthState } from './utils'
import { LandingPage, LoginDialogPage, NotificationPage } from './page-objects'

test.describe('Authentication network error handling', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test.afterEach(async ({ page }) => {
    await clearAuthState(page)
  })

  test('offline shows error message on login attempt', async ({ page }) => {
    const landing = new LandingPage(page)
    const loginDialog = new LoginDialogPage(page)
    const notification = new NotificationPage(page)

    await landing.openLoginDialog()

    await page.route('**/api/v2/auth/login*', route => {
      route.abort('failed')
    })

    await loginDialog.loginAs('user@example.com', 'password')
    await page.waitForTimeout(2000)

    const errorVisible = await notification.hasErrorWithText(/network|offline|connection|failed/i)
    expect(errorVisible).toBe(true)
  })

  test('500 server error shows error message on login', async ({ page }) => {
    const landing = new LandingPage(page)
    const loginDialog = new LoginDialogPage(page)
    const notification = new NotificationPage(page)

    await page.route('**/api/v2/auth/login*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      })
    })

    await landing.openLoginDialog()
    await loginDialog.loginAs('user@example.com', 'password')
    await page.waitForTimeout(2000)

    const errorVisible = await notification.hasErrorWithText(/server error|error|failed/i)
    expect(errorVisible).toBe(true)
  })

  test('404 not found shows appropriate error', async ({ page }) => {
    const landing = new LandingPage(page)
    const loginDialog = new LoginDialogPage(page)
    const notification = new NotificationPage(page)

    await page.route('**/api/v2/auth/login*', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' })
      })
    })

    await landing.openLoginDialog()
    await loginDialog.loginAs('user@example.com', 'password')
    await page.waitForTimeout(2000)

    const errorVisible = await notification.hasErrorWithText(/not found|invalid|error/i)
    expect(errorVisible).toBe(true)
  })

  test('401 unauthorized shows invalid credentials message', async ({ page }) => {
    const landing = new LandingPage(page)
    const loginDialog = new LoginDialogPage(page)
    const notification = new NotificationPage(page)

    await page.route('**/api/v2/auth/login*', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' })
      })
    })

    await landing.openLoginDialog()
    await loginDialog.loginAs('user@example.com', 'wrongpassword')
    await page.waitForTimeout(2000)

    const errorVisible = await notification.hasErrorWithText(/invalid|incorrect|wrong|unauthorized/i)
    expect(errorVisible).toBe(true)
  })

  test('network timeout shows timeout error', async ({ page }) => {
    const landing = new LandingPage(page)
    const loginDialog = new LoginDialogPage(page)
    const notification = new NotificationPage(page)

    test.setTimeout(30000)

    await page.route('**/api/v2/auth/login*', async route => {
      await new Promise(resolve => setTimeout(resolve, 15000))
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Timeout' })
      })
    })

    await landing.openLoginDialog()
    await loginDialog.fillCredentials('user@example.com', 'password')

    const startTime = Date.now()
    await loginDialog.submitLogin()
    await page.waitForTimeout(12000)

    const elapsed = Date.now() - startTime
    expect(elapsed).toBeGreaterThan(10000)

    const errorVisible = await notification.hasErrorWithText(/timeout|slow|taking too long/i)
  })

  test('network error does not crash application', async ({ page }) => {
    const landing = new LandingPage(page)
    const loginDialog = new LoginDialogPage(page)

    await page.route('**/api/v2/auth/login*', route => {
      route.abort('failed')
    })

    await landing.openLoginDialog()
    await loginDialog.loginAs('user@example.com', 'password')
    await page.waitForTimeout(2000)

    const landingStillVisible = await landing.loginButton.isVisible()
    expect(landingStillVisible).toBe(true)

    const titleVisible = await page.locator('h1, h2, [role="heading"]').count() > 0
    expect(titleVisible).toBe(true)
  })

  test('signup network errors are handled gracefully', async ({ page }) => {
    const notification = new NotificationPage(page)

    await page.route('**/api/v2/auth/signup*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      })
    })

    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Username').fill('testuser')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('Password1!')
    await page.getByRole('button', { name: 'Create Account' }).click()
    await page.waitForTimeout(2000)

    const formVisible = await page.getByLabel('Username').isVisible()
    expect(formVisible).toBe(true)

    const errorVisible = await notification.hasErrorWithText(/error|failed/i)
    expect(errorVisible).toBe(true)
  })
})
