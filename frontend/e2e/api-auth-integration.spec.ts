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

test.describe('authenticateViaAPI contract', () => {
  async function mockContext(browser: import('@playwright/test').Browser, loginStatus: number, refreshStatus: number) {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()
    await context.route('**/api/v2/auth/login', (route: import('@playwright/test').Route) =>
      route.fulfill({ status: loginStatus, body: '{}', contentType: 'application/json' }),
    )
    await context.route('**/api/v2/auth/refresh', (route: import('@playwright/test').Route) =>
      route.fulfill({ status: refreshStatus, body: '{}', contentType: 'application/json' }),
    )
    return { context, page }
  }

  test('success result shape contains no error or phase', async ({ browser }) => {
    const { context, page } = await mockContext(browser, 200, 200)
    const result = await authenticateViaAPI(page.request, { usernameOrEmail: 'u', password: 'p' })
    expect(result).toEqual({ ok: true, status: 200 })
    await context.close()
  })

  test('login failure short-circuits before calling refresh', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()
    let refreshCalled = false
    await context.route('**/api/v2/auth/login', (route: import('@playwright/test').Route) =>
      route.fulfill({ status: 401, body: '{}', contentType: 'application/json' }),
    )
    await context.route('**/api/v2/auth/refresh', async (route: import('@playwright/test').Route) => {
      refreshCalled = true
      await route.fulfill({ status: 200, body: '{}', contentType: 'application/json' })
    })
    const result = await authenticateViaAPI(page.request, { usernameOrEmail: 'u', password: 'p' })
    expect(result).toEqual({ ok: false, status: 401, error: 'Login failed: 401', phase: 'login' })
    expect(refreshCalled).toBe(false)
    await context.close()
  })

  test('refresh failure returns refresh phase with upstream status', async ({ browser }) => {
    const { context, page } = await mockContext(browser, 200, 500)
    const result = await authenticateViaAPI(page.request, { usernameOrEmail: 'u', password: 'p' })
    expect(result).toEqual({ ok: false, status: 500, error: 'Token refresh failed: 500', phase: 'refresh' })
    await context.close()
  })

  test('login credentials are forwarded verbatim as post body', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()
    let capturedBody: unknown
    await context.route('**/api/v2/auth/login', async (route: import('@playwright/test').Route) => {
      capturedBody = route.request().postDataJSON()
      await route.fulfill({ status: 200, body: '{}', contentType: 'application/json' })
    })
    await context.route('**/api/v2/auth/refresh', (route: import('@playwright/test').Route) =>
      route.fulfill({ status: 200, body: '{}', contentType: 'application/json' }),
    )
    const credentials = { usernameOrEmail: 'user@test.com', password: 'secret' }
    await authenticateViaAPI(page.request, credentials)
    expect(capturedBody).toEqual(credentials)
    await context.close()
  })

  test('login non-2xx status is reflected with login phase', async ({ browser }) => {
    const { context, page } = await mockContext(browser, 403, 200)
    const result = await authenticateViaAPI(page.request, { usernameOrEmail: 'u', password: 'p' })
    expect(result).toEqual({ ok: false, status: 403, error: 'Login failed: 403', phase: 'login' })
    await context.close()
  })

  test('refresh non-2xx status is reflected with refresh phase', async ({ browser }) => {
    const { context, page } = await mockContext(browser, 200, 503)
    const result = await authenticateViaAPI(page.request, { usernameOrEmail: 'u', password: 'p' })
    expect(result).toEqual({ ok: false, status: 503, error: 'Token refresh failed: 503', phase: 'refresh' })
    await context.close()
  })
})
