import { expect, Page } from '@playwright/test'
import { e2eEnv } from './e2e-env-vars'

async function setupUnauthenticatedPage(page: Page) {
  await page.route('**/api/v2/auth/refresh', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await page.route('**/api/v2/users/current', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'e2e-user', name: 'E2E User', mail: 'e2e@example.com', roles: [] }),
    })
  })
}

async function signup(page: Page, username: string, mail: string, password: string) {
  await page.goto('/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(mail)
  await page.getByLabel('Password').fill(password)
  
  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/api/v2/auth/signup') && resp.request().method() === 'POST' && resp.ok(),
      { timeout: 10000 }
    ),
    page.getByRole('button', { name: 'Create Account' }).click(),
  ])

  await page.goto('/')
}

async function openLoginDialogFromSignup(page: Page) {
  await page.goto('/register')

  const loginButton = page.locator('span[data-type="login"]')
  await loginButton.click()
}

async function login(page: Page, usernameOrEmail: string, password: string, valid = true, fromSignUp = false) {
  if (!fromSignUp) {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')
    await page.locator('span[data-type="login"]').click()
  } else {
    await openLoginDialogFromSignup(page)
  }
  
  await page.getByPlaceholder(/username.*email/i).fill(usernameOrEmail)
  await page.getByPlaceholder(/password/i).fill(password)

  const confirmButton = page.locator('button[data-type="confirm-login"]')
  await confirmButton.waitFor({ state: 'visible', timeout: 5000 })
  
  const authPromise = page.waitForResponse(
    resp => resp.url().includes('/api/v2/auth/login') && resp.request().method() === 'POST',
    { timeout: 15000 }
  )
  
  await confirmButton.click()

  if (valid) {
    const authResp = await authPromise
    if (!authResp.ok()) {
      throw new Error(`Auth failed: ${authResp.status()} ${await authResp.text()}`)
    }
    
    await page.waitForResponse(
      resp => resp.url().includes('/api/v2/auth/refresh') && resp.request().method() === 'POST' && resp.ok(),
    )
  }
}

async function rejectUser(page: Page, username: string) {
  if (!page.url().endsWith('/admin/waitlist')) {
    await page.goto('/admin/waitlist', { waitUntil: 'networkidle' })
  }

  const searchBox = page.getByPlaceholder('Search')
  await expect(searchBox).toBeVisible({ timeout: 5000 })
  await searchBox.fill(username)

  const row = page.locator('table tbody tr', { hasText: username }).first()
  await expect(row).toBeVisible()
  await row.click()

  await Promise.all([
    page.waitForResponse(
      resp =>
        resp.url().includes('/api/v2/statistics/waitlist/reject') && resp.request().method() === 'POST' && resp.ok(),
    ),
    page.getByRole('button', { name: 'Reject' }).first().click(),
  ])

  const messages = page.getByText('Accounts removed from the waitlist')
  await expect(messages.first()).toBeVisible()
}

async function approveUser(page: Page, username: string) {
  await page.goto('/admin/waitlist', { waitUntil: 'networkidle' })
  await page.waitForLoadState('networkidle')
  
  await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 10000 })
  
  const row = page.locator('table tbody tr', { hasText: username }).first()
  const isVisible = await row.isVisible().catch(() => false)
  
  if (!isVisible) {
    const searchInput = page.getByPlaceholder(/search/i).or(page.locator('input[type="search"]')).or(page.locator('input[placeholder*="Search"]'))
    if (await searchInput.count() > 0) {
      await searchInput.first().fill(username)
      await page.waitForTimeout(1000)
      await row.waitFor({ state: 'visible', timeout: 10000 })
    } else {
      await expect(row).toBeVisible({ timeout: 10000 })
    }
  }
  
  await row.click()

  await Promise.all([
    page.waitForResponse(
      resp =>
        resp.url().includes('/api/v2/statistics/waitlist/confirm') && resp.request().method() === 'POST' && resp.ok(),
    ),
    page.getByRole('button', { name: 'Approve', exact: true }).first().click(),
  ])

  await expect(page.getByText('All accounts approved')).toBeVisible()
}

async function logout(page: Page) {
  await page.locator('[data-type="user-settings"]').click()
  
  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/auth/logout') && resp.request().method() === 'POST',
      { timeout: 10000 }
    ),
    page.getByRole('button', { name: 'Log out' }).click(),
  ])
}

async function adminLogin(page: Page) {
  if (!e2eEnv.E2E_ADMIN_USER || !e2eEnv.E2E_ADMIN_PASS) {
    throw new Error('Missing E2E_ADMIN_USER/E2E_ADMIN_PASS env vars for admin login')
  }

  await login(page, e2eEnv.E2E_ADMIN_USER, e2eEnv.E2E_ADMIN_PASS)
}

async function createWorkflow(page: Page): Promise<string> {
  await page.goto('/workflows')
  await page.waitForLoadState('networkidle')

  await Promise.all([
    page.waitForURL(/\/workflow\//),
    page.getByRole('button', { name: /create.*workflow/i }).click(),
  ])

  const currentUrl = page.url()
  const workflowId = currentUrl.split('/').filter(Boolean).pop() || ''
  
  if (!workflowId) {
    throw new Error(`Unable to extract workflowId from URL: ${currentUrl}`)
  }

  return workflowId
}

export { approveUser, rejectUser, login, logout, signup, openLoginDialogFromSignup, adminLogin, setupUnauthenticatedPage, createWorkflow }
