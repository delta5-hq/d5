import { test, expect, Page } from '@playwright/test'
import { adminLogin, approveUser, login, logout, rejectUser, signup } from './utils'

function testUUID() {
  return Math.random().toString(36).slice(2, 10)
}

test.describe.serial('Auth flows', () => {
  test('New user registers -> login attempt fails -> forgot password fails', async ({ page }) => {
    const suffix = testUUID()
    const newUser = { name: `user_${suffix}`, mail: `user_${suffix}@example.com`, password: 'Password1!' }

    await signup(page, newUser.name, newUser.mail, newUser.password)

    await login(page, newUser.mail, newUser.password, false, true)
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('login-submit-button')).toBeVisible({ timeout: 5000 })

    await page.getByRole('link', { name: /forgot.*password/i }).click()
    await page.getByLabel(/email.*username/i).fill(newUser.mail)
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v2/auth/forgot-password') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /send.*recovery/i }).click(),
    ])
    await page.waitForLoadState('networkidle')
  })

  test('Two new users register -> admin rejects both -> both login fail', async ({ page }) => {
    const suffix = testUUID()
    const userA = { name: `userA_${suffix}`, mail: `userA_${suffix}@example.com`, password: 'Password1!' }
    const userB = { name: `userB_${suffix}`, mail: `userB_${suffix}@example.com`, password: 'Password1!' }

    await signup(page, userA.name, userA.mail, userA.password)
    await signup(page, userB.name, userB.mail, userB.password)

    await adminLogin(page)
    await rejectUser(page, userA.name)
    await rejectUser(page, userB.name)

    await logout(page)

    await login(page, userA.mail, userA.password, false)

    await expect(page.locator('[data-sonner-toast]').getByText(/User not found|Account pending activation/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Account Settings')).toHaveCount(0)

    await page.getByRole('button', { name: /cancel/i }).click()

    await login(page, userB.mail, userB.password, false)

    await expect(page.locator('[data-sonner-toast]').getByText(/User not found|Account pending activation/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Account Settings')).toHaveCount(0)
  })

  test('Two new users register -> admin approves second -> first fails login, second succeeds -> logout -> forgot password success', async ({
    page,
  }) => {
    const suffix = testUUID()
    const userA = { name: `userA_${suffix}`, mail: `userA_${suffix}@example.com`, password: 'Password1!' }
    const userB = { name: `userB_${suffix}`, mail: `userB_${suffix}@example.com`, password: 'Password1!' }

    await signup(page, userA.name, userA.mail, userA.password)
    await signup(page, userB.name, userB.mail, userB.password)

    await adminLogin(page)
    await approveUser(page, userB.name)

    await logout(page)

    await login(page, userA.mail, userA.password, false)
    await expect(page.locator('[data-sonner-toast]').getByText(/User not found|Account pending activation|Invalid login/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Account Settings')).toHaveCount(0)

    await page.getByRole('button', { name: /cancel/i }).click()

    await login(page, userB.mail, userB.password)

    await expect(page.locator('[data-type="user-settings"]')).toBeVisible()

    await logout(page)

    await page.goto('/forgot-password')
    await page.getByLabel('Email or Username').fill(userB.mail)
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/v2/auth/forgot-password') && r.request().method() === 'POST' && r.ok(),
      ),
      page.getByRole('button', { name: 'Send recovery link' }).click(),
    ])
    await expect(page.getByText('Email Sent')).toBeVisible()
  })
})
