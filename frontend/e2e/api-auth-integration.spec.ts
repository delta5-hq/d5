import { expect, test } from '@playwright/test'
import { authenticateViaAPI } from './helpers/api-auth'
import { e2eEnv } from './utils/e2e-env-vars'

test.describe('API Authentication Integration', () => {
  test('successful auth sets cookies for subsequent requests', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()

    const authResult = await authenticateViaAPI(page.request, {
      usernameOrEmail: e2eEnv.E2E_ADMIN_USER,
      password: e2eEnv.E2E_ADMIN_PASS,
    })

    expect(authResult.ok).toBe(true)
    expect(authResult.status).toBe(200)
    expect(authResult.error).toBeUndefined()

    const userResponse = await page.request.get('/api/v2/users/current')
    expect(userResponse.ok()).toBe(true)

    const userData = await userResponse.json()
    expect(userData.mail).toContain('@')

    await context.close()
  })

  test('invalid credentials fail at login phase', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()

    const authResult = await authenticateViaAPI(page.request, {
      usernameOrEmail: 'nonexistent@example.com',
      password: 'wrongpassword',
    })

    expect(authResult.ok).toBe(false)
    expect(authResult.status).toBe(401)
    expect(authResult.phase).toBe('login')
    expect(authResult.error).toContain('Login failed')

    await context.close()
  })

  test('subscriber credentials authenticate successfully', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()

    const authResult = await authenticateViaAPI(page.request, {
      usernameOrEmail: e2eEnv.E2E_SUBSCRIBER_USER || 'subscriber',
      password: e2eEnv.E2E_SUBSCRIBER_PASS || 'P@ssw0rd!',
    })

    expect(authResult.ok).toBe(true)
    expect(authResult.status).toBe(200)

    const userResponse = await page.request.get('/api/v2/users/current')
    expect(userResponse.ok()).toBe(true)

    await context.close()
  })

  test('integration endpoint requires auth after successful login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()

    const unauthResponse = await page.request.get('/api/v2/integration')
    expect(unauthResponse.ok()).toBe(false)

    await authenticateViaAPI(page.request, {
      usernameOrEmail: e2eEnv.E2E_ADMIN_USER,
      password: e2eEnv.E2E_ADMIN_PASS,
    })

    const authResponse = await page.request.get('/api/v2/integration')
    expect(authResponse.ok()).toBe(true)

    await context.close()
  })
})
