import { test, expect, Page } from '@playwright/test'
import { randomUUID } from 'crypto'

const ADMIN_USER = process.env.E2E_ADMIN_USER
const ADMIN_PASS = process.env.E2E_ADMIN_PASS

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
  await page.getByText('Log In').first().click()
}

async function login(page: Page, usernameOrEmail: string, password: string) {
  await openLoginDialogFromSignup(page)
  await page.getByPlaceholder('Username or Email').fill(usernameOrEmail)
  await page.getByPlaceholder('Password').fill(password)

  await page.getByRole('button', { name: 'Log In' }).click()
}

async function adminLogin(page: Page) {
  if (!ADMIN_USER || !ADMIN_PASS) {
    throw new Error('Missing E2E_ADMIN_USER/E2E_ADMIN_PASS env vars for admin login')
  }

  await Promise.all([
    login(page, ADMIN_USER!, ADMIN_PASS!),
    page.waitForResponse(resp => resp.url().includes('/api/v1/auth') && resp.status() === 200),
  ])
}

async function rejectUser(page: Page, username: string) {
  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/api/v1/statistics/waitlist') && resp.request().method() === 'GET' && resp.ok(),
    ),
    page.goto('/admin/waitlist'),
  ])

  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/api/v1/statistics/waitlist') && resp.request().method() === 'GET' && resp.ok(),
    ),
    page.getByPlaceholder('Search').fill(username),
  ])

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

  await expect(page.getByText('Accounts removed from the waitlist')).toBeVisible()
}

async function approveUser(page: Page, username: string) {
  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/api/v1/statistics/waitlist') && resp.request().method() === 'GET' && resp.ok(),
    ),
    page.goto('/admin/waitlist'),
  ])

  await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('/api/v1/statistics/waitlist') && resp.request().method() === 'GET' && resp.ok(),
    ),
    page.getByPlaceholder('Search').fill(username),
  ])
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

test.describe.serial('Auth flows', () => {
  test('New user registers -> login attempt fails -> forgot password fails', async ({ page }) => {
    const suffix = randomUUID()
    const newUser = { name: `user_${suffix}`, mail: `user_${suffix}@example.com`, password: 'Password1!' }

    await signup(page, newUser.name, newUser.mail, newUser.password)

    await login(page, newUser.mail, newUser.password)
    await expect(page.getByText('User not found')).toBeVisible()
    await expect(page.getByText('Account Settings')).toHaveCount(0)

    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await page.getByLabel('Email or Username').fill(newUser.mail)
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/auth/forgot-password') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Send recovery link' }).click(),
    ])
    await expect(page.getByText('User not found', { exact: true })).toBeVisible()
  })

  test('Two new users register -> admin rejects both -> both login fail', async ({ page }) => {
    const suffix = randomUUID()
    const userA = { name: `userA_${suffix}`, mail: `userA_${suffix}@example.com`, password: 'Password1!' }
    const userB = { name: `userB_${suffix}`, mail: `userB_${suffix}@example.com`, password: 'Password1!' }

    await signup(page, userA.name, userA.mail, userA.password)
    await signup(page, userB.name, userB.mail, userB.password)

    await adminLogin(page)
    await rejectUser(page, userA.name)
    await rejectUser(page, userB.name)

    await logout(page)

    await login(page, userA.mail, userA.password)

    await expect(page.getByText('User not found')).toBeVisible()
    await expect(page.getByText('Account Settings')).toHaveCount(0)

    await login(page, userB.mail, userB.password)
    await expect(page.getByText('User not found')).toBeVisible()
    await expect(page.getByText('Account Settings')).toHaveCount(0)
  })

  test('Two new users register -> admin approves second -> first fails login, second succeeds -> logout -> forgot password success', async ({
    page,
  }) => {
    const suffix = randomUUID()
    const userA = { name: `userA_${suffix}`, mail: `userA_${suffix}@example.com`, password: 'Password1!' }
    const userB = { name: `userB_${suffix}`, mail: `userB_${suffix}@example.com`, password: 'Password1!' }

    await signup(page, userA.name, userA.mail, userA.password)
    await signup(page, userB.name, userB.mail, userB.password)

    await adminLogin(page)
    await approveUser(page, userB.name)

    await logout(page)

    await login(page, userA.mail, userA.password)
    await expect(page.getByText(/User not found|Account pending activation|Invalid login/i)).toBeVisible()
    await expect(page.getByText('Account Settings')).toHaveCount(0)

    await login(page, userB.mail, userB.password)

    await expect(page.locator('[data-type="user-settings"]')).toBeVisible()

    await logout(page)

    await page.goto('/forgot-password')
    await page.getByLabel('Email or Username').fill(userB.mail)
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v1/auth/forgot-password') && r.request().method() === 'POST' && r.ok(),
      ),
      page.getByRole('button', { name: 'Send recovery link' }).click(),
    ])
    await expect(page.getByText('Email Sent')).toBeVisible()
  })
})
