import { expect, Page } from '@playwright/test'
import { e2eEnv } from './e2e-env-vars'

async function signup(page: Page, username: string, mail: string, password: string) {
  await page.goto('/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(mail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()

  await page.goto('/')
}

async function openLoginDialogFromSignup(page: Page) {
  await page.goto('/register')

  const loginButton = page.locator('span[data-type="login"]')
  await loginButton.click()
}

async function login(page: Page, usernameOrEmail: string, password: string, valid = true, fromSignUp = false) {
  if (!fromSignUp) {
    await page.locator('[data-type="login"]').click()
  } else {
    await openLoginDialogFromSignup(page)
  }
  await page.getByPlaceholder('Username or Email').fill(usernameOrEmail)
  await page.getByPlaceholder('Password').fill(password)

  await page.locator('[data-type="confirm-login"]').click()

  if (valid) {
    await page.waitForResponse(
      resp => resp.url().includes('/api/v1/auth') && resp.request().method() === 'POST' && resp.ok(),
    )
    await page.waitForResponse(
      resp => resp.url().includes('/api/v1/auth/refresh') && resp.request().method() === 'POST' && resp.ok(),
    )
  }
}

async function rejectUser(page: Page, username: string) {
  if (!page.url().endsWith('/admin/waitlist')) {
    await page.goto('/admin/waitlist', { waitUntil: 'networkidle' })
  }

  await page.getByPlaceholder('Search').fill(username)

  const row = page.locator('table tbody tr', { hasText: username }).first()
  await expect(row).toBeVisible()
  await row.click()

  await Promise.all([
    page.waitForResponse(
      resp =>
        resp.url().includes('/api/v1/statistics/waitlist/reject') && resp.request().method() === 'POST' && resp.ok(),
    ),
    page.getByRole('button', { name: 'Reject' }).first().click(),
  ])

  const messages = page.getByText('Accounts removed from the waitlist')
  await expect(messages.first()).toBeVisible()
}

async function approveUser(page: Page, username: string) {
  if (!page.url().endsWith('/admin/waitlist')) {
    await page.goto('/admin/waitlist', { waitUntil: 'networkidle' })
  }

  await page.getByPlaceholder('Search').fill(username)

  const row = page.locator('table tbody tr', { hasText: username }).first()
  await expect(row).toBeVisible()
  await row.click()

  await Promise.all([
    page.waitForResponse(
      resp =>
        resp.url().includes('/api/v1/statistics/waitlist/confirm') && resp.request().method() === 'POST' && resp.ok(),
    ),
    page.getByRole('button', { name: 'Approve', exact: true }).first().click(),
  ])

  await expect(page.getByText('All accounts approved')).toBeVisible()
}

async function logout(page: Page) {
  await page.locator('[data-type="user-settings"]').click()
  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/api/v1/auth/logout') && resp.request().method() === 'POST' && resp.ok(),
    ),
    page.getByRole('menuitem', { name: 'Log out' }).click(),
  ])

  await expect(page.getByText('Account Settings')).toHaveCount(0)
}

async function adminLogin(page: Page) {
  if (!e2eEnv.E2E_ADMIN_USER || !e2eEnv.E2E_ADMIN_PASS) {
    throw new Error('Missing E2E_ADMIN_USER/E2E_ADMIN_PASS env vars for admin login')
  }

  await login(page, e2eEnv.E2E_ADMIN_USER, e2eEnv.E2E_ADMIN_PASS)
}

export { approveUser, rejectUser, login, logout, signup, openLoginDialogFromSignup, adminLogin }
